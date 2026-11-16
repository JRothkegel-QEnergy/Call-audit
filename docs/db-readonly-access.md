# Consultar la base de producción (solo lectura)

Visor SQL web en **https://audit.qubicoenergy.com/db/** ([pgweb](https://github.com/sosedoff/pgweb)). Se entra desde el
navegador con usuario `consulta` y su clave. No hace falta instalar nada.

La conexión usa el usuario de Postgres `qubico_readonly`: no puede modificar datos, cada consulta se corta a los 60 s y
no ve las contraseñas ni los enlaces de invitación de `users`. Por eso `SELECT * FROM users` da error de permisos y hay
que nombrar las columnas, por ejemplo `SELECT id, name, email, role, status FROM users`.

La clave es lo único que protege el visor, que está en internet: quien la tenga puede leer toda la base salvo esos
campos. Es una clave por persona de confianza; si se filtra, se cambia (abajo).

## Desde un script (para trabajar con Claude)

`scripts/readonly/qubico_db.py` usa la misma clave del visor, pero por la API de pgweb. No necesita SSH, la llave del
servidor ni instalar nada aparte de Python 3.10+. Tiene los mismos límites que el visor: no escribe (una consulta con
`DELETE`, `UPDATE`, etc. se rechaza), corta a los 60 s y no ve las credenciales de `users`.

```bash
export QUBICO_DB_PASSWORD='<clave del visor>'
python scripts/readonly/qubico_db.py query "SELECT status, count(*) FROM cases GROUP BY 1"
python scripts/readonly/qubico_db.py query "SELECT ..." --out resultado.csv     # o .json
python scripts/readonly/qubico_db.py dump                                       # ~/qubico-dump/<fecha>/
```

`dump` tarda alrededor de un minuto y deja (~250 MB):

- `qubico.db`: todas las tablas que ve `qubico_readonly` en un solo archivo SQLite (las columnas JSON como texto, para
  `json_extract`). Es lo que conviene subir a Drive junto con `calls/`.
- `tables/<tabla>.jsonl`: las mismas tablas, una fila por línea.
- `calls/<call_id>.md`: una ficha por llamada con los metadatos, el veredicto de la corredora, cada corrida de la IA
  (solo los motivos que no cumple o quedan dudosos, con su cita), la revisión del auditor y la transcripción.

Para iterar con Claude, abre Claude Code en esa carpeta (o pásale la ruta) y pregúntale directamente; puede leer las
fichas y, si necesita algo al día, correr `query` él mismo. El volcado no va a git: trae transcripciones reales.

## Publicarlo o actualizarlo

Desde `call-audit-rcv`, con Docker Desktop y la llave SSH del despliegue:

```bash
bash scripts/deploy/readonly_access.sh
```

Levanta solo pgweb y Caddy (HTTPS se corta unos segundos). La clave queda en `.deploy/pgweb_password`. `deploy.sh` no
despliega sin haber corrido esto una vez. Hay que volver a correrlo después de una migración que agregue tablas: las
tablas nuevas no se exponen solas.

## Cambiar la clave

Borrar `.deploy/pgweb_password`, volver a correr el script y entregar la clave nueva.

## Quitar el acceso

En el EC2, `cd /opt/call-audit && docker compose -f docker-compose.prod.yml rm -sf pgweb`; en la base:

```sql
DROP OWNED BY qubico_readonly;
DROP ROLE qubico_readonly;
```

Para que no vuelva con el siguiente despliegue, sacar además el bloque `pgweb` de `docker-compose.prod.yml`, el `handle /db*`
del `Caddyfile` y las variables `PGWEB_*` de `deploy.sh` y `.deploy/server.env`.
