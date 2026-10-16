# Revisión manual de llamadas reales

Cómo revisar en equipo la validación de la capa 2 sobre las 100 llamadas reales: cada persona escucha el audio, lee la transcripción y lo que dijo cada IA, y anota su veredicto y sus observaciones.

- El **código** viene de este repo.
- El **dashboard** (`dashboard.html`, con las transcripciones) se envía por un canal interno de la empresa. Nunca por git ni por correo personal: tiene datos reales.
- Los **audios** se escuchan directo desde S3 con enlaces que vencen en 7 días. No se descargan.

## Para revisores

### 1. Instalar (una vez)

1. **Python 3.10 o superior**: [python.org/downloads](https://www.python.org/downloads/). En Windows, marca **"Add python.exe to PATH"** al instalar.
2. **Descargar el repo**, de una de estas dos formas:
   - Con git: `git clone -b feature/real-calls-validation https://github.com/JRothkegel-QEnergy/Call-audit.git call-audit`
   - Sin git: en GitHub, cambia a la rama `feature/real-calls-validation` y usa **Code → Download ZIP**. Descomprímelo y renombra la carpeta a `call-audit`.

No hay que instalar nada más: el servidor de revisión usa solo Python.

### 2. Poner el dashboard

Crea la carpeta `call-audit/revision/` y copia ahí el `dashboard.html` que te enviaron:

```
call-audit/
  revision/
    dashboard.html   ← el que te enviaron
  scripts/
  ...
```

`revision/` está en `.gitignore`: lo que pongas ahí no se sube al repo.

### 3. Abrir

- **Windows:** doble clic en `call-audit/scripts/prompt_bench/revisar.bat`. Escribe tu nombre (por ejemplo `ana-perez`) y se abre el navegador.
- **Mac o Linux:** desde la carpeta `call-audit`, corre esto con tu nombre:

  ```bash
  python3 scripts/prompt_bench/review_server.py --root revision --revisor ana-perez --open
  ```

Si el navegador no se abre solo, entra a <http://127.0.0.1:8765/dashboard.html>. Deja la ventana negra abierta mientras revisas; para terminar, ciérrala o aprieta Ctrl+C.

### 4. Revisar

Por cada llamada, marca tu veredicto, si acertó cada IA y una nota con lo que observaste. Se guarda solo, a los segundos, en `call-audit/revision/revision_capa2_<tu-nombre>.csv`. Abajo del dashboard aparece "Guardado en …" cuando quedó guardado.

- Usa **siempre el mismo nombre**: con otro nombre empiezas un archivo nuevo.
- Puedes cerrar y volver otro día: al abrir de nuevo, retoma lo que llevabas.
- Si un audio no carga, el enlace venció (duran 7 días). Pide un dashboard nuevo y reemplaza el anterior. Tu CSV no se pierde.

### 5. Entregar

Envía tu `revision/revision_capa2_<tu-nombre>.csv` por el mismo canal interno por el que recibiste el dashboard.

## Para quien prepara la revisión

Se hace una vez por tanda, desde la carpeta `Qubico Develop`.

1. **Subir los audios** a `s3://qubico-call-audit/audios/`. Ya están los 101 de octubre de 2026.
2. **Credenciales:** instala el [AWS CLI](https://aws.amazon.com/cli/) y corre `aws configure` con la **clave de acceso de tu usuario IAM**, región `sa-east-1`. Con SSO o credenciales temporales, los enlaces vencen cuando vence tu sesión, no en 7 días.
3. **Instalar boto3:** `pip install -r call-audit/scripts/prompt_bench/requirements.txt`.
4. **Generar el dashboard para compartir:**

   ```bash
   python call-audit/scripts/prompt_bench/share_dashboard.py transcripts/layer2_real_100_v2.7/dashboard.html --bucket qubico-call-audit
   ```

   Deja `transcripts/layer2_real_100_v2.7/compartir/dashboard.html`, con los audios firmados por 7 días. Avisa si falta algún audio en S3.

5. **Enviar** ese `dashboard.html` por el canal interno, junto con el link a esta guía, y avisa hasta qué fecha funcionan los audios.
6. **Juntar las revisiones:** deja todos los `revision_capa2_*.csv` que te devuelvan en una carpeta y corre:

   ```bash
   python call-audit/scripts/prompt_bench/merge_reviews.py <carpeta>
   ```

   Deja `<carpeta>/revision_consolidada.csv`, con una fila por revisor y llamada.

Para renovar los enlaces, repite el paso 4 y reenvía el dashboard. Las revisiones ya hechas siguen sirviendo.
