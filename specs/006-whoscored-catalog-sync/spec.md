# Feature Specification: Catálogo de Jugadores con Datos Reales (WhoScored)

**Feature Branch**: `006-whoscored-catalog-sync`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Funcionalidad de catálogo con datos reales — WhoScored. Reemplaza los datos de prueba de la feature de catálogo por datos reales obtenidos mediante scraping de WhoScored, sin modificar el contrato ya implementado de GET /players y GET /players/:id: mismos filtros combinables por liga, equipo y posición, misma paginación (page/pageSize), mismo comportamiento ante filtros sin resultados o id inexistente, y la misma exigencia de autenticación que tenga el catálogo en ese momento. El scraper obtiene sus datos de páginas de estadísticas de partido por jugador (por ejemplo, whoscored.com/players/:id/matchstatistics/:nombre). El scraper se limita a las mismas 5 ligas que cubría el catálogo de prueba (Premier League, Bundesliga, La Liga, Serie A, Ligue 1), no trae jugadores de otras ligas. La sincronización real trae el plantel completo de cada equipo de esas ligas, sin tope artificial de cantidad. Esta feature agrega al jugador los campos de métricas de rendimiento: pases completados, tiros, intercepciones y calificación. La incorporación de datos ocurre mediante una sincronización periódica programada (scheduler), nunca disparada por una request de catálogo: un usuario consultando GET /players siempre lee de la última sincronización exitosa. La frecuencia exacta de esa sincronización es un detalle de implementación que se resuelve en el speckit-plan. WhoScored identifica la posición de un jugador con códigos más finos que el enum propio del sistema (GK/DF/MF/FW) — por ejemplo GK, DR/DC/DL, DMC/DM, MC/ML/MR, AMC/AML/AMR, FWR/FW/FWL, entre otros. Documentá como decisión de diseño la siguiente tabla de mapeo: cualquier código de arquero mapea a GK; cualquier código de defensor o lateral mapea a DF; cualquier código de mediocampo (doble pivote, interiores, volantes por izquierda/derecha) mapea a MF; cualquier código de delantero o extremo mapea a FW. Dejá explícito como decisión aceptada que un código de posición que no matchea ninguna de las cuatro categorías de arriba hace que ese jugador puntual no se importe en esa sincronización, y queda registrado en un log para revisión manual."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el catálogo con datos reales de las 5 ligas (Priority: P1)

Un cliente integrador con una ApiKey válida consulta el listado de jugadores (con o sin filtros de liga, equipo y posición, y paginado) y obtiene jugadores reales de la Premier League, Bundesliga, La Liga, Serie A y Ligue 1, incluyendo sus métricas de rendimiento, en lugar de los 20 jugadores ficticios de la versión de prueba.

**Why this priority**: Es el objetivo central de la feature — sin esto, el catálogo sigue siendo el de datos de prueba y no aporta valor real como insumo para el Sistema de cotización.

**Independent Test**: Se puede probar de forma aislada, con al menos una sincronización ya ejecutada exitosamente, invocando el listado con una ApiKey válida (con y sin filtros de liga/equipo/posición) y verificando que los jugadores devueltos pertenecen a equipos y ligas reales de las 5 ligas soportadas, incluyen las cuatro métricas de rendimiento, y que el contrato de filtros, paginación y respuesta ante "sin resultados" se comporta exactamente igual que en la versión de datos de prueba.

**Acceptance Scenarios**:

1. **Given** al menos una sincronización exitosa ya ejecutada y una ApiKey válida, **When** se solicita el listado sin filtros, **Then** el sistema responde 200 con jugadores reales de las 5 ligas soportadas, cada uno con nombre, liga, equipo, posición (mapeada al enum GK/DF/MF/FW) y sus cuatro métricas de rendimiento.
2. **Given** el mismo escenario anterior, **When** se filtra por liga, por equipo, por posición o por una combinación de estos (AND), **Then** el sistema responde igual que antes: sólo los jugadores reales que cumplen todos los filtros presentes, respetando `page`/`pageSize` con los mismos defaults y máximos ya vigentes.
3. **Given** el mismo escenario anterior, **When** se filtra por una combinación de liga/equipo/posición que ningún jugador real cumple, **Then** el sistema responde 200 con lista vacía y total 0, no un error.
4. **Given** el id real de un jugador existente en la última sincronización exitosa, **When** se solicita su detalle, **Then** el sistema responde 200 con sus datos (nombre, liga, equipo, posición) y sus cuatro métricas de rendimiento.
5. **Given** un id que no corresponde a ningún jugador de la última sincronización exitosa, **When** se solicita su detalle, **Then** el sistema responde 404, igual que con el catálogo de prueba.
6. **Given** cualquiera de los dos endpoints, **When** se invoca sin ApiKey, con una ApiKey inválida o revocada, o presentando un JWT en su lugar, **Then** el sistema rechaza la operación exactamente con la misma exigencia de autenticación que ya tiene el catálogo en ese momento, sin exponer ningún dato.

---

### User Story 2 - El catálogo siempre refleja la última sincronización exitosa, nunca una consulta en vivo (Priority: P1)

Un cliente integrador consulta el catálogo en cualquier momento y siempre recibe los datos de la última sincronización periódica que terminó exitosamente, sin que su consulta dispare un scraping en vivo a WhoScored ni quede a la espera de uno.

**Why this priority**: Es una decisión estructural explícita del enunciado: desacopla la disponibilidad y el tiempo de respuesta del catálogo de la disponibilidad de WhoScored, y es coherente con el principio de la constitución de que una falla del proveedor externo no debe bloquear una operación que sólo depende de datos ya persistidos.

**Independent Test**: Se puede probar de forma aislada simulando que la sincronización programada falla (o no se ejecuta) y verificando que GET /players y GET /players/:id siguen respondiendo con los datos de la última sincronización exitosa anterior, sin error y sin latencia adicional; y por separado, verificando que ninguna llamada a estos endpoints, sin importar los filtros, dispara tráfico de red hacia WhoScored.

**Acceptance Scenarios**:

1. **Given** una sincronización exitosa previa ya persistida, **When** la sincronización programada más reciente falla o no llega a completarse, **Then** GET /players y GET /players/:id siguen respondiendo con los datos de la última sincronización exitosa anterior, sin exponer ningún error relacionado con la falla de la sincronización.
2. **Given** cualquier request a GET /players o GET /players/:id, **When** se procesa, **Then** el sistema no realiza ningún scraping ni llamada a WhoScored como parte de esa request: sólo lee datos ya persistidos localmente.
3. **Given** que la sincronización de un equipo puntual termina exitosamente, **When** se completa, **Then** las siguientes consultas al catálogo reflejan de inmediato el plantel actualizado de ese equipo (alta de los jugadores nuevos, baja de los que ya no están), sin esperar a que el resto de los equipos o ligas también terminen su actualización en esa misma corrida, y sin requerir ninguna acción del cliente integrador.

---

### User Story 3 - Mapeo de posiciones finas de WhoScored al enum propio, con exclusión auditable de códigos no reconocidos (Priority: P2)

El proceso de sincronización traduce los códigos de posición detallados que usa WhoScored (por ejemplo GK, DR/DC/DL, DMC/DM, MC/ML/MR, AMC/AML/AMR, FWR/FW/FWL) a una de las cuatro posiciones del enum propio del sistema (GK/DF/MF/FW); cuando un código no encaja en ninguna de las cuatro categorías, ese jugador puntual no se importa en esa sincronización y queda registrado en un log para revisión manual, sin afectar la importación del resto de los jugadores.

**Why this priority**: Es una decisión de diseño explícitamente pedida por el enunciado que garantiza que el enum propio del sistema (ya usado por los filtros de posición del catálogo) se mantenga estable aunque WhoScored use una nomenclatura más fina, sin perder trazabilidad de los casos no mapeados.

**Independent Test**: Se puede probar de forma aislada alimentando el mapeador con cada código de posición documentado (de arquero, defensa, mediocampo y delantero) y verificando que cada uno resuelve a la categoría GK/DF/MF/FW correspondiente; y por separado, alimentándolo con un código fuera de esa tabla y verificando que el jugador no se persiste en esa sincronización y que queda un registro en el log de revisión manual con datos suficientes para identificarlo (por ejemplo, su identificador de WhoScored, nombre y el código de posición no reconocido), sin que esto interrumpa la importación de los demás jugadores del mismo equipo.

**Acceptance Scenarios**:

1. **Given** un jugador cuyo código de posición en WhoScored es de arquero (p. ej. GK), **When** se procesa en la sincronización, **Then** se importa con posición GK.
2. **Given** un jugador cuyo código de posición en WhoScored es de defensa o lateral (p. ej. DR, DC, DL), **When** se procesa, **Then** se importa con posición DF.
3. **Given** un jugador cuyo código de posición en WhoScored es de mediocampo (p. ej. DMC, DM, MC, ML, MR, AMC, AML, AMR), **When** se procesa, **Then** se importa con posición MF.
4. **Given** un jugador cuyo código de posición en WhoScored es de delantero o extremo (p. ej. FWR, FW, FWL), **When** se procesa, **Then** se importa con posición FW.
5. **Given** un jugador cuyo código de posición en WhoScored no matchea ninguna de las cuatro categorías anteriores, **When** se procesa, **Then** ese jugador no se importa en esa sincronización, queda un registro en un log de revisión manual identificándolo, y el resto de los jugadores de su equipo se importa con normalidad.

---

### Edge Cases

- **Todas las sincronizaciones ejecutadas hasta el momento fallaron** (nunca hubo una exitosa): el catálogo está vacío; GET /players responde 200 con lista vacía y total 0 (mismo comportamiento que "sin resultados"), GET /players/:id responde 404 para cualquier id, sin exponer detalles de la falla del scraper.
- **No se puede obtener la lista de equipos vigentes de una liga puntual** (WhoScored no responde o cambia la estructura de esa página): sólo esa liga se salta en esa corrida; las demás ligas y sus equipos se actualizan con normalidad, y la liga afectada sigue sirviendo los equipos y jugadores de su última actualización exitosa anterior hasta la próxima corrida.
- **Falla el scraping del plantel de un equipo puntual** (WhoScored no responde, cambia su estructura de página, etc.): sólo ese equipo queda sin actualizar en esa corrida y sigue sirviendo los datos de su última sincronización exitosa anterior; el resto de los equipos de esa liga y de las demás ligas se actualiza con normalidad. La falla queda registrada para diagnóstico.
- **Se obtiene bien el plantel de un equipo, pero falla puntualmente la página de estadísticas de partido de uno de sus jugadores**: ese jugador igual se importa (nombre, liga, equipo y posición si se conocen), con sus métricas de rendimiento en `null` y un registro en el log de revisión manual identificándolo; esto no cuenta como una falla del equipo ni afecta al resto de sus jugadores.
- **Un jugador aparece en el plantel de un equipo con un código de posición no reconocido**: no se importa en esa sincronización de ese equipo (ver User Story 3), sin que esto cuente como una falla del resto del equipo; si en una sincronización posterior WhoScored corrige o cambia ese código a uno reconocido, el jugador se importa normalmente a partir de esa corrida.
- **Filtro de posición con un valor fuera del enum propio (GK/DF/MF/FW)**: se sigue rechazando con 400, igual que en el catálogo de prueba — el enum expuesto en el contrato de filtros no cambia.
- **Un jugador deja de estar en el plantel de un equipo de las 5 ligas** (transferencia fuera de las 5 ligas, retiro, etc.) entre una sincronización y la siguiente: deja de aparecer en el catálogo a partir de la sincronización exitosa que ya no lo incluye en ningún plantel (ver Design Decisions y FR-016); una consulta posterior a su id anterior responde 404.
- **Dos jugadores reales comparten nombre**: el listado y el detalle igual los distinguen por su identificador interno, no por nombre, igual que en la versión de prueba.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST seguir exponiendo GET /players y GET /players/:id con exactamente el mismo contrato ya implementado por el catálogo de datos de prueba: mismos filtros combinables por liga, equipo y posición (AND), misma paginación (`page`/`pageSize` con sus defaults y máximo vigentes), mismo formato de respuesta (items + total), y mismos códigos de estado ante filtros sin resultados (200 con lista vacía) e id inexistente (404).
- **FR-002**: Tanto GET /players como GET /players/:id MUST seguir exigiendo exactamente el mismo mecanismo de autenticación que tenga el catálogo vigente al momento de esta feature (ApiKey válida, sin aceptar JWT como alternativa), sin relajar ni endurecer ese requisito.
- **FR-003**: El sistema MUST obtener los datos de los jugadores mediante scraping de páginas de estadísticas de partido por jugador de WhoScored (p. ej. `whoscored.com/players/:id/matchstatistics/:nombre`), en lugar de los datos de prueba cargados a mano.
- **FR-004**: El scraping MUST limitarse a jugadores de las 5 ligas ya soportadas por el catálogo (Premier League, Bundesliga, La Liga, Serie A, Ligue 1); el sistema MUST NOT incorporar jugadores de ninguna otra liga.
- **FR-005**: Una sincronización exitosa MUST traer el plantel completo de cada equipo de esas 5 ligas, sin aplicar ningún tope artificial a la cantidad de jugadores importados por equipo o por liga.
- **FR-006**: Cada jugador del catálogo MUST incluir, además de nombre, liga, equipo y posición, las siguientes métricas de rendimiento: pases completados, tiros, intercepciones y calificación; cada una de estas cuatro métricas MUST ser nullable, ya que un jugador puede no tener un valor disponible (ver FR-007, FR-018).
- **FR-007**: Las métricas de rendimiento de cada jugador MUST representar el promedio por partido jugado en la temporada en curso, tal como surge de las páginas de estadísticas de partido de WhoScored, y MUST actualizarse en cada sincronización exitosa.
- **FR-008**: La incorporación de datos reales MUST ocurrir exclusivamente a través de una sincronización periódica programada (scheduler); ninguna request a GET /players o GET /players/:id MUST disparar, directa ni indirectamente, un scraping en vivo a WhoScored.
- **FR-009**: GET /players y GET /players/:id MUST responder siempre en base a los datos ya persistidos localmente — el resultado combinado de la última actualización exitosa de cada equipo, liga por liga — y MUST NOT esperar a que ninguna sincronización en curso termine para responder.
- **FR-010**: Si en una corrida no se puede actualizar una liga o un equipo puntual, el sistema MUST seguir sirviendo, para esa liga o ese equipo, los datos de su última actualización exitosa anterior, sin degradar la disponibilidad ni el tiempo de respuesta de GET /players y GET /players/:id, y sin que la falla se propague a las ligas o equipos que sí se actualizaron con éxito en esa misma corrida.
- **FR-011**: El sistema MUST traducir el código de posición fino que usa WhoScored a una de las cuatro posiciones del enum propio (GK/DF/MF/FW), aplicando la tabla de mapeo documentada en Design Decisions (arquero → GK, defensor/lateral → DF, mediocampo → MF, delantero/extremo → FW).
- **FR-012**: Si el código de posición de un jugador no matchea ninguna de las cuatro categorías de la tabla de mapeo, el sistema MUST excluir a ese jugador puntual de la importación en esa sincronización, sin interrumpir la importación del resto de los jugadores de su equipo o de otros equipos.
- **FR-013**: Todo jugador excluido por código de posición no reconocido MUST quedar registrado en un log destinado a revisión manual, con información suficiente para identificarlo (como mínimo su identificador de WhoScored, nombre, equipo y el código de posición no reconocido recibido).
- **FR-014**: El éxito o el fracaso del scraping en una corrida MUST evaluarse en tres niveles independientes, sin que un fallo en uno se propague a los demás: (a) **por liga** — si no se puede obtener la lista de equipos vigentes de una liga, sólo esa liga se salta esa corrida; (b) **por equipo** — si no se puede scrapear el plantel completo de un equipo puntual, sólo ese equipo se salta esa corrida; (c) **por jugador** — la exclusión puntual de un jugador por código de posición no reconocido (FR-012) o la imposibilidad de obtener su página de estadísticas (FR-018) MUST NOT hacer fallar a su equipo.
- **FR-015**: Si una liga o un equipo puntual no logra actualizarse en una corrida según los niveles de FR-014, el sistema MUST conservar, para esa liga o ese equipo, los datos de su última actualización exitosa anterior tal cual estaban, sin aplicar datos parciales ni vacíos en su lugar.
- **FR-016**: Cada corrida que logra scrapear con éxito el plantel completo de un equipo MUST reemplazar, para ese equipo específico, el conjunto de jugadores vigentes por lo que efectivamente encontró en esa corrida (alta de los jugadores nuevos, baja de los que ya no están en ese plantel): un jugador previamente importado que ya no forme parte del plantel scrapeado de su equipo MUST dejar de estar disponible en el catálogo (GET /players/:id sobre su id anterior MUST responder 404 a partir de ese momento). Este reemplazo es independiente por equipo: MUST NOT depender de que otros equipos o ligas también se hayan actualizado con éxito en la misma corrida.
- **FR-017**: El sistema MUST seguir siendo de sólo lectura a través de GET /players y GET /players/:id: esta feature MUST NOT exponer operaciones de alta, baja o modificación de jugadores invocables directamente por un cliente del catálogo; la única vía de escritura del catálogo MUST ser la sincronización programada.
- **FR-018**: Si el plantel de un equipo se obtuvo con éxito pero no se pudo obtener la página de estadísticas de partido de un jugador puntual de ese plantel, el sistema MUST importar igual a ese jugador (con los datos que sí se conocen: nombre, liga, equipo y posición) con sus cuatro métricas de rendimiento en `null`; esto MUST NOT contar como una falla del equipo (FR-014). Ese jugador MUST quedar registrado en un log destinado a revisión manual, con información suficiente para identificarlo (como mínimo su identificador de WhoScored, nombre y equipo) — mismo criterio que FR-013 exige para el jugador excluido por posición no reconocida.

### Key Entities *(include if feature involves data)*

- **Jugador**: Entidad principal del catálogo, ahora poblada con datos reales. Atributos conceptuales:
  - **Identificador**: Referencia unívoca del jugador dentro del catálogo, usada para pedir su detalle.
  - **Nombre**: Nombre real del jugador, tal como lo publica WhoScored.
  - **Liga**: Una de las 5 ligas soportadas.
  - **Equipo**: Equipo real del jugador dentro de su liga, según el plantel vigente en la última sincronización de equipo exitosa de ese equipo.
  - **Posición**: Una de las 4 posiciones del enum propio (GK/DF/MF/FW), resultado de aplicar la tabla de mapeo a la posición fina de WhoScored.
  - **Pases completados**: Métrica de rendimiento, promedio por partido de la temporada en curso; `null` si no hay un valor disponible para ese jugador (ver Sincronización de equipo).
  - **Tiros**: Métrica de rendimiento, promedio por partido de la temporada en curso; `null` si no hay un valor disponible para ese jugador.
  - **Intercepciones**: Métrica de rendimiento, promedio por partido de la temporada en curso; `null` si no hay un valor disponible para ese jugador.
  - **Calificación**: Métrica de rendimiento, promedio por partido de la temporada en curso; `null` si no hay un valor disponible para ese jugador.
- **Sincronización de equipo**: Unidad independiente de éxito o fracaso del proceso periódico de scraping, acotada a un equipo puntual de una liga. Atributos conceptuales: equipo y liga a la que corresponde, momento de ejecución, resultado (exitosa / fallida), y el plantel de jugadores que quedó vigente para ese equipo si fue exitosa. Cada equipo conserva el plantel de su última sincronización de equipo exitosa hasta que una corrida posterior logre sincronizarlo de nuevo; el catálogo expuesto por GET /players y GET /players/:id siempre corresponde, para cada equipo, a su última sincronización de equipo exitosa. Obtener la lista de equipos vigentes de una liga (paso previo para saber a qué equipos intentar sincronizar) es en sí mismo una operación por liga: si falla, ningún equipo nuevo de esa liga se intenta sincronizar en esa corrida, y los equipos ya conocidos de esa liga simplemente conservan su última sincronización de equipo exitosa, igual que ante la falla de un equipo puntual.
- **Registro de revisión manual**: Entrada de log, no expuesta por API, que identifica a un jugador para que alguien lo revise manualmente. Cubre dos motivos distintos, que no son el mismo caso:
  - **Posición no reconocida (FR-013)**: el jugador NO se importa en esa sincronización, porque su código de posición de WhoScored no matchea ninguna categoría del mapeo; la revisión decide si corresponde ampliar la tabla de mapeo.
  - **Falla técnica al obtener la página de estadísticas (FR-018)**: el jugador SÍ se importa (con sus datos de plantel), pero con sus cuatro métricas de rendimiento en `null` porque no se pudo obtener su página individual de estadísticas; la revisión sirve para diagnosticar esa falla puntual, no para decidir un mapeo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las requests a GET /players y GET /players/:id, con los mismos filtros, paginación y credenciales que ya se probaban contra el catálogo de datos de prueba, mantienen el mismo comportamiento observable (mismos códigos de estado, misma forma de la respuesta, mismas reglas de filtrado/paginación/autenticación).
- **SC-002**: Después de al menos una sincronización exitosa, el catálogo contiene jugadores reales de las 5 ligas soportadas, con al menos un jugador por cada equipo cuyo plantel se haya podido scrapear completo, sin ningún tope artificial de cantidad por equipo.
- **SC-003**: El 100% de los jugadores importados exponen las cuatro métricas de rendimiento (pases completados, tiros, intercepciones, calificación) como promedio por partido de la temporada en curso.
- **SC-004**: El 100% de los jugadores cuyo código de posición de WhoScored matchea alguna de las cuatro categorías documentadas quedan mapeados a la posición correcta del enum propio (GK/DF/MF/FW).
- **SC-005**: El 100% de los jugadores cuyo código de posición no matchea ninguna categoría quedan excluidos de esa sincronización y registrados en el log de revisión manual, sin impedir la importación del resto del plantel.
- **SC-006**: Una falla de WhoScored como proveedor, sea a nivel de una liga puntual, de un equipo puntual o de un jugador puntual, nunca produce un error ni una degradación de tiempo de respuesta perceptible en GET /players o GET /players/:id, ni afecta a las ligas o equipos no involucrados en esa falla: cada equipo sigue respondiendo con los datos de su última sincronización de equipo exitosa.
- **SC-007**: Ninguna request de un cliente a GET /players o GET /players/:id genera tráfico de red hacia WhoScored: el 100% del tráfico hacia WhoScored proviene exclusivamente de corridas de la sincronización programada.

## Design Decisions

### Scraping vía páginas de estadísticas de partido por jugador, limitado a las 5 ligas ya soportadas

El scraper obtiene sus datos navegando las páginas de estadísticas de partido por jugador
de WhoScored (p. ej. `whoscored.com/players/:id/matchstatistics/:nombre`), recorriendo
los planteles completos de los equipos de las 5 ligas ya soportadas por el catálogo de
prueba (Premier League, Bundesliga, La Liga, Serie A, Ligue 1), sin incorporar jugadores
de otras ligas ni aplicar un tope artificial de cantidad por equipo. Esto reemplaza la
carga manual de 20 jugadores ficticios de la feature `004-player-catalog`, manteniendo
intacto su contrato de listado, detalle, filtros, paginación y autenticación (Principio
XII de la constitución: toda ambigüedad se resuelve como decisión explícita, no
silenciosa).

### Sincronización periódica programada, nunca disparada por el catálogo

La incorporación de datos reales ocurre únicamente vía un scheduler que corre de forma
periódica; GET /players y GET /players/:id sólo leen datos ya persistidos por la última
sincronización exitosa, nunca disparan ni esperan un scraping en vivo. Esto es
consistente con el Principio I de la constitución ("Degradación ante fallo del proveedor
externo"): una operación de lectura que sólo depende de datos ya persistidos no debe
bloquearse por la caída de WhoScored. La frecuencia exacta del scheduler es un detalle de
implementación que se resuelve en `speckit-plan`, no en esta spec.

**Decisión aceptada**: la unidad de éxito o fracaso del scraping MUST NOT ser la corrida
completa de las 5 ligas, sino tres niveles independientes que no se arrastran entre sí
(FR-014): **liga** (obtener la lista de equipos vigentes), **equipo** (obtener el plantel
completo de un equipo) y **jugador** (obtener la página de estadísticas de un jugador
puntual dentro de un plantel ya obtenido). Si falla un nivel, sólo esa liga, ese equipo o
ese jugador puntual se salta esa corrida (FR-015, FR-018); el resto del sistema —incluidas
las demás ligas y equipos de la misma corrida— se actualiza con normalidad. Se prefirió
esta granularidad sobre un todo-o-nada de las 5 ligas porque una corrida completa puede
tardar en cubrir cientos de jugadores de decenas de equipos, y descartarla entera por la
falla de un único equipo o liga dejaría a todo el catálogo desactualizado por un problema
acotado, además de desperdiciar el trabajo de scraping ya completado con éxito en esa
misma corrida.

### Reemplazo por equipo de los planteles vigentes, con degradación independiente por liga y por equipo

Cada sincronización de equipo exitosa reemplaza el conjunto de jugadores vigentes de ese
equipo específico por lo que efectivamente encontró en esa corrida (FR-016): un jugador
que ya no está en el plantel scrapeado de su equipo deja de estar disponible en el
catálogo, y su id anterior pasa a responder 404. Se prefirió esta semántica de "espejo del
estado actual" sobre conservar jugadores dados de baja marcados como no vigentes, porque
el propósito del catálogo es reflejar los planteles reales vigentes como insumo para el
Sistema de cotización, y un jugador que ya no juega en las 5 ligas soportadas no aporta
valor de cotización; mantenerlo indefinidamente con datos cada vez más viejos sería más
confuso que útil. A diferencia de un reemplazo global de las 5 ligas a la vez, este
reemplazo es independiente por equipo: un equipo cuyo plantel no se pudo scrapear en una
corrida simplemente no dispara ningún reemplazo esa vez y conserva su plantel anterior
(FR-015), sin que eso dependa de que los demás equipos o ligas también se hayan
sincronizado con éxito en la misma corrida.

### Métricas de rendimiento como promedio por partido de la temporada en curso

Pases completados, tiros, intercepciones y calificación se calculan como el promedio por
partido jugado en la temporada en curso, tal como surge de las páginas de estadísticas de
partido de WhoScored, y se recalculan en cada sincronización exitosa. Se prefirió el
promedio por partido sobre el acumulado de temporada porque hace comparables entre sí a
jugadores con distinta cantidad de partidos jugados, que es el uso previsible de estas
métricas como insumo para valuar jugadores.

### Tabla de mapeo de posición fina de WhoScored al enum propio (GK/DF/MF/FW)

WhoScored identifica la posición de un jugador con códigos más finos que el enum propio
del sistema. Se adopta la siguiente tabla de mapeo como decisión de diseño:

| Categoría WhoScored | Ejemplos de código | Mapea a |
|----------------------|---------------------|---------|
| Arquero | GK | GK |
| Defensor / lateral | DR, DC, DL | DF |
| Mediocampo (doble pivote, interiores, volantes por izquierda/derecha) | DMC, DM, MC, ML, MR, AMC, AML, AMR | MF |
| Delantero / extremo | FWR, FW, FWL | FW |

**Decisión aceptada**: un código de posición que no matchea ninguna de las cuatro
categorías de arriba hace que ese jugador puntual no se importe en esa sincronización.
Ese jugador queda registrado en un log para revisión manual (identificador de WhoScored,
nombre, equipo y código recibido), y el resto de los jugadores de su equipo y de las
demás ligas se importa con normalidad. Se prefirió excluir al jugador puntual y loguearlo
antes que: (a) fallar la sincronización completa por un solo código no reconocido, lo
cual sería desproporcionado y dejaría todo el catálogo desactualizado por un caso aislado;
o (b) inventar un mapeo por defecto (p. ej. mapear cualquier código desconocido a MF), lo
cual introduciría datos de posición incorrectos sin que nadie lo note. Ampliar la tabla de
mapeo ante un código nuevo detectado en el log es trabajo de mantenimiento, no un caso que
esta feature deba resolver automáticamente.

## Assumptions

- El id expuesto por el catálogo (usado en GET /players/:id) es un identificador propio
  del sistema, no necesariamente igual al id de WhoScored; el id de WhoScored se conserva
  internamente como referencia para el scraping y para los registros del log de revisión
  manual, pero no es parte del contrato público ya vigente de la feature `004`.
- El mecanismo de autenticación (ApiKey, sin aceptar JWT) y su comportamiento ante
  ausencia, invalidez o revocación siguen siendo exactamente los definidos en
  `004-player-catalog`; esta feature no los modifica, sólo los reutiliza.
- "Temporada en curso" se resuelve con el mismo criterio que usa WhoScored en sus páginas
  de estadísticas de partido al momento de cada sincronización (la temporada que WhoScored
  esté mostrando como vigente para esa liga); esta spec no fija una fecha de corte propia.
- Si un jugador no registró ninguna estadística de partido en la temporada en curso al
  momento de la sincronización (p. ej. no debutó todavía), o si se pudo obtener el resto
  de su plantel pero no su página individual de estadísticas (FR-018), sus métricas de
  rendimiento se registran como `null`, no como `0`: como FR-007 define cada métrica como
  un promedio por partido jugado, el promedio de un jugador con cero partidos es
  matemáticamente indefinido, no cero, y un jugador con (por ejemplo) 0 intercepciones
  reales en partidos que sí jugó no puede representarse de la misma forma que uno sin
  datos disponibles.
- El scraping respeta los términos de uso y las limitaciones técnicas de acceso de
  WhoScored (frecuencia de requests, posible necesidad de reintentos o backoff); los
  detalles concretos de esa implementación se resuelven en `speckit-plan`, no en esta spec.
- Esta feature no modifica el enum de posición expuesto por el contrato de filtros
  (`GK`/`DF`/`MF`/`FW`); sólo cambia el origen de los datos y agrega el paso de mapeo
  desde la nomenclatura fina de WhoScored.
- El log de revisión manual de posiciones no reconocidas (FR-013) es un mecanismo de
  observabilidad interno (no expuesto por API); su formato concreto de almacenamiento
  (archivo, tabla, sistema de logging estructurado ya exigido por el Principio VII) es un
  detalle de implementación a resolver en `speckit-plan`.
