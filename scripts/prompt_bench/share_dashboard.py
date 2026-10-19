"""Prepara un dashboard para compartirlo con otros revisores: cambia la ruta local de cada audio por una URL
prefirmada de S3, así nadie necesita los audios en su PC ni credenciales de AWS.

Uso (desde "Qubico Develop"):
    python call-audit/scripts/prompt_bench/share_dashboard.py transcripts/layer2_real_100_v2.7/dashboard.html \
        --bucket qubico-call-audit [--prefix audios/] [--region sa-east-1] [--days 7] [--out DIR/dashboard.html]
    python call-audit/scripts/prompt_bench/share_dashboard.py <dashboard.html> --no-audio   # solo transcripciones

Requiere boto3 y credenciales de AWS (aws configure). Los audios tienen que estar en s3://<bucket>/<prefix><grabación>.mp3.
Las URLs duran como máximo 7 días y solo si se firman con la clave de acceso de un usuario IAM: con credenciales
temporales (SSO, rol) vencen junto con la sesión.

Rearma la página con dashboard_template.html actual, con los mismos datos. El HTML resultante sigue teniendo
transcripciones reales: se comparte por un canal interno de la empresa, nunca por git.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

MARK = "const D = "
MAX_DAYS = 7


def read_data(html: str) -> dict:
    start = html.index(MARK) + len(MARK)
    data, _ = json.JSONDecoder().raw_decode(html, start)
    return data


def presign_audios(data: dict, args: argparse.Namespace) -> None:
    import boto3
    from botocore.config import Config

    session = boto3.Session(region_name=args.region)
    creds = session.get_credentials()
    if creds is None:
        sys.exit("No hay credenciales de AWS: corre `aws configure` con la clave de acceso de tu usuario IAM")
    if creds.get_frozen_credentials().token:
        print("Ojo: credenciales temporales (SSO o rol). Las URLs vencerán cuando venza tu sesión, no en "
              f"{args.days} días. Usa la clave de un usuario IAM para que duren lo pedido.", file=sys.stderr)
    # Endpoint regional: con el global (s3.amazonaws.com) un bucket nuevo fuera de us-east-1 puede responder con redirect.
    s3 = session.client(
        "s3",
        endpoint_url=f"https://s3.{args.region}.amazonaws.com",
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )

    # Verifica que estén todos los audios antes de firmar: una URL a un objeto que no existe firma igual.
    keys = set()
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=args.bucket, Prefix=args.prefix):
        keys.update(o["Key"] for o in page.get("Contents", []))

    missing = []
    for call in data["calls"]:
        key = f"{args.prefix}{call['recording']}.mp3"
        if key not in keys:
            missing.append(key)
        call["audio"] = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": args.bucket, "Key": key, "ResponseContentType": "audio/mpeg"},
            ExpiresIn=args.days * 86400,
        )
    if missing:
        print(f"Faltan {len(missing)} audios en s3://{args.bucket}/{args.prefix}:", *missing, sep="\n  ", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dashboard", type=Path)
    parser.add_argument("--bucket")
    parser.add_argument("--no-audio", action="store_true", help="solo transcripciones: no incluye audios ni usa AWS")
    parser.add_argument("--prefix", default="audios/")
    parser.add_argument("--region", default="sa-east-1")
    parser.add_argument("--days", type=int, default=MAX_DAYS)
    parser.add_argument("--out", type=Path, help="por defecto <carpeta del dashboard>/compartir/dashboard.html")
    args = parser.parse_args()
    if not args.no_audio and not args.bucket:
        parser.error("falta --bucket (o --no-audio para compartir solo las transcripciones)")
    if not 1 <= args.days <= MAX_DAYS:
        sys.exit(f"--days tiene que estar entre 1 y {MAX_DAYS} (límite de S3 para URLs prefirmadas)")

    data = read_data(args.dashboard.read_text(encoding="utf-8"))
    if args.no_audio:
        for call in data["calls"]:
            call["audio"] = None
    else:
        presign_audios(data, args)
    for call in data["calls"]:
        call["asr_viewer"] = None  # el visor de ASR es local: no viaja con el dashboard compartido

    template = (Path(__file__).parent / "dashboard_template.html").read_text(encoding="utf-8")
    page = template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out = args.out or args.dashboard.parent / "compartir" / "dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    if args.no_audio:
        print(f"{out}  ({len(data['calls'])} llamadas, sin audios)")
    else:
        until = (datetime.now() + timedelta(days=args.days)).strftime("%d-%m-%Y %H:%M")
        print(f"{out}  ({len(data['calls'])} llamadas, audios válidos hasta el {until})")


if __name__ == "__main__":
    main()
