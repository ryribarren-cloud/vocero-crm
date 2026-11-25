# Operación de barbería en Vocero

## Punto de partida

Se compararon `b29900d` de Kevin y `00b3549` de `vocero/plantilla-laboral`. El entorno de producción reportó `00b3549` en `/api/health`. El trabajo y los datos sintéticos se mantuvieron fuera de producción.

| Flujo | Base de Kevin y cambios que ya tenía el fork | Implementación en esta rama |
|---|---|---|
| Identidad | Better Auth identifica al usuario. La membresía determina el negocio y el rol. El fork añadió acceso Barbero y la lectura de membresía por solicitud. | Recepción tiene una pantalla propia y acceso explícito a las rutas de operación. Los miembros anteriores conservan su rol. |
| Personas | `0027` vinculó reservas a miembros. `0028` creó fichas y copió las asignaciones existentes. El alta de ficha admitía cuenta opcional y exigía unicidad. | El propietario crea o renombra puestos y edita nombre, puesto, horario, elegibilidad y vínculo en la misma ficha. Las citas siguen apuntando a su ID estable. |
| Agenda | Ya existían crear, mover, cancelar, bloques, calendario móvil y los filtros de responsable y sin asignar del fork. «Mis citas» filtraba por la cuenta asociada, pero un solo texto cubría las dos causas de una lista vacía. | Se distinguen los dos estados vacíos. Una ficha vinculada da acceso a sus reservas. La agenda permite asignar una reserva existente y bloquear a una persona concreta. |
| Disponibilidad | Horario semanal por negocio, duración y anticipo. El índice único por negocio e instante impedía las citas en paralelo incluso con personal distinto. | Los horarios individuales limitan el del negocio. Un intervalo sin ficha ocupa a todos. La base serializa las escrituras activas del negocio y comprueba el intervalo completo. Una cita cancelada o no asistida libera el hueco. |
| WhatsApp | El webhook resuelve el contacto y la conversación. Vocero despacha al cerebro externo. La oferta almacenaba el instante, sin responsable. | `GET /api/bot/availability` devuelve opciones con ficha y disponibilidad. Acepta `staffId` o `staffName`, o reconoce una mención inequívoca del nombre de ficha en el último mensaje entrante. La oferta guarda el ID que utilizará el POST de reserva. Ante nombres iguales debe elegirse un ID. |

## Permisos

| Operación | Propietario | Recepción | Barbero | Miembro existente |
|---|---|---|---|---|
| Alta de cuentas, cambios de rol, puestos y fichas | Sí | Denegado | Denegado | Denegado |
| Consultar agenda general y registrar clientes | Sí | Sí | Denegado | Sí |
| Crear, asignar, reagendar y cancelar | Sí | Sí | Denegado | Sí |
| Consultar y marcar Atendida o No asistió | Agenda general | Agenda general | Solo citas de su ficha | Agenda general |
| Resto del CRM | Según las reglas de cada módulo | Acceso limitado a recepción | Acceso limitado a Mis citas | Permisos previos de cada módulo |

La pertenencia y el rol se resuelven por solicitud. El formulario de resultado de un barbero comprueba la cuenta, el rol, la organización y el vínculo en la misma escritura. Una pestaña antigua puede conservar contenido ya renderizado hasta la siguiente carga. La desvinculación conserva la ficha y las reservas.

## Citas antiguas y apuestas de compatibilidad

Las fichas existentes arrancan habilitadas para atender, como en el selector previo. El horario propio vacío indica descanso, y desactivar el horario propio recupera el horario del negocio. Una cita anterior sin asignar aparece en el filtro «Sin asignar» y ocupa el intervalo para todo el equipo. Al asignarla, el bloqueo se limita a esa ficha. La concurrencia se comprueba en PostgreSQL para reservas reales y bloqueos. Las conversaciones marcadas como ensayos del laboratorio mantienen el aislamiento histórico de Vocero.

## Qué se puede comprobar con datos

Una lista vacía en producción requiere contrastar el ID de miembro, el vínculo de la ficha y los IDs guardados en las reservas del mismo negocio. Las pruebas solo usan identidades sintéticas. La mención de Miguel se comprueba comparando el ID de la oferta, el de la reserva en PostgreSQL y el de la ficha mostrada en ambas agendas. Que el CRM acepte estas llamadas no prueba que una instalación concreta de Sophia las haga.

## Reproducir las pruebas

`node scripts/test-barber-upgrade.mjs` usa PostgreSQL local, crea una base temporal, aplica el esquema hasta 0028, carga datos previos y ejecuta las migraciones restantes. Compara las referencias antes y después y elimina únicamente esa base temporal.

`node scripts/e2e-barberia.mjs` necesita una instancia local recién migrada y vacía, `APP_BASE_URL`, `DATABASE_URL`, `BOT_API_KEY`, `AGENDA=true`, el mock de WhatsApp activado y `META_GRAPH_BASE_URL` apuntando a `/api/dev/wa-mock/graph` de la misma instancia. El puerto del webhook simulado debe coincidir con `PORT`. Utiliza Chromium de Playwright o `BROWSER_PATH`. Las cuentas creadas, el número simulado y las reservas son de prueba. El ensayo del contrato llama a las herramientas que invocaría el cerebro externo.
