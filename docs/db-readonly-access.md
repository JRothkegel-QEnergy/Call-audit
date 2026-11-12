# Consultar la base de producción (solo lectura)

Visor SQL web en **https://audit.qubicoenergy.com/db/** ([pgweb](https://github.com/sosedoff/pgweb)). Se entra desde el
navegador con usuario `consulta` y su clave. No hace falta instalar nada.

La conexión usa el usuario de Postgres `qubico_readonly`: no puede modificar datos, cada consulta se corta a los 60 s y
no ve las contraseñas ni los enlaces de invitación de `users`. Por eso `SELECT * FROM users` da error de permisos y hay
que nombrar las columnas, por ejemplo `SELECT id, name, email, role, status FROM users`.

La clave es lo único que protege el visor, que está en internet: quien la tenga puede leer toda la base salvo esos
campos. Es una clave por persona de confianza; si se filtra, se cambia (abajo).

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
