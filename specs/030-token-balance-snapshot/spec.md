# Feature Specification: Snapshot de saldo en la auditoría de tokens

**Feature Branch**: `030-token-balance-snapshot`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Snapshot de saldo en la auditoría de tokens — cada entrada de `TokenTransaction` registra, además de lo que ya registra hoy (autor, timestamp, tipo de movimiento CREDIT/DEBIT, monto, vínculo con la orden/fill que lo originó), el saldo de esa tenencia puntual (ese usuario, ese jugador) inmediatamente antes y después de aplicar el movimiento. No se recalcula después: se captura en el mismo punto donde `TokenHolding.credit`/`debit` ya conoce el saldo anterior y el resultante. Aplica a todo movimiento que pase por `credit`/`debit`, incluida la emisión inicial de los 100 tokens de cada jugador al superusuario. Las entradas ya existentes se completan con una migración única que recorre el historial de cada tenencia en orden cronológico. Decisión de diseño: por qué un backfill y no dejar los históricos vacíos (Principio V). Fuera de alcance, aceptado como riesgo: el backfill asume un historial completo y bien ordenado; no se agrega validación cruzada contra el saldo actual."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada movimiento de una operación queda con su saldo anterior y posterior (Priority: P1)

Quien audita las operaciones de tokens (o resuelve una disputa sobre una compraventa) necesita ver, en cada asiento de auditoría, cuántos tokens de ese jugador tenía el usuario justo antes del movimiento y cuántos justo después, sin tener que sumar todo el historial anterior para averiguarlo.

**Why this priority**: Es el núcleo de la feature y lo que exige el Principio V de la constitución ("estado anterior y estado posterior" en toda operación). Sin él, el resto (emisión, backfill) no tiene dónde apoyarse.

**Independent Test**: Hacer que un usuario con una cantidad conocida de tokens de un jugador compre o venda una cantidad conocida, y verificar que sus asientos de auditoría traen el saldo anterior y el posterior esperados, tanto para el comprador como para el vendedor.

**Acceptance Scenarios**:

1. **Given** un comprador que tiene 10 tokens de un jugador, **When** se ejecuta una compra de 5 de ese jugador, **Then** su asiento de tipo CREDIT queda con saldo anterior 10 y saldo posterior 15.
2. **Given** un vendedor que tiene 10 tokens de un jugador, **When** se ejecuta una venta de 4 de ese jugador, **Then** su asiento de tipo DEBIT queda con saldo anterior 10 y saldo posterior 6.
3. **Given** un usuario que no tenía ningún token de ese jugador (sin tenencia previa), **When** compra 3, **Then** su asiento queda con saldo anterior 0 y saldo posterior 3.
4. **Given** una orden que se ejecuta contra varias contrapartes en el mismo instante (varios movimientos sobre la misma tenencia), **When** se registran sus asientos, **Then** cada uno parte del saldo que dejó el movimiento anterior de esa tenencia: la cadena es continua, sin saltos ni solapamientos.
5. **Given** una orden cuyo comprador y vendedor son el mismo usuario (auto-cruce), **When** se registran sus dos asientos, **Then** el CREDIT parte del saldo original y llega a un saldo intermedio, el DEBIT parte de ese saldo intermedio y termina en el saldo original, y ambos son coherentes con el saldo final de la tenencia.
6. **Given** cualquier asiento nuevo, **When** se lo lee, **Then** el saldo posterior es igual al anterior más la cantidad (CREDIT) o menos la cantidad (DEBIT), y ninguno de los dos saldos es negativo.
7. **Given** una operación que falla a mitad de camino y se descarta, **When** se consulta la auditoría, **Then** no quedó ningún asiento ni se modificó ninguna tenencia (el saldo auditado y el saldo real nunca divergen).

---

### User Story 2 - La emisión inicial también queda auditada (Priority: P1)

Quien audita el sistema necesita que los tokens que el sistema emite al superusuario en el momento cero (la liquidez inicial de 100 tokens por jugador) aparezcan en la auditoría igual que cualquier otro movimiento, con saldo anterior 0 y saldo posterior 100. Hoy esos tokens existen en la tenencia pero no dejan ningún asiento: son el único movimiento de saldo que cambia una tenencia sin quedar registrado.

**Why this priority**: Sin el asiento de emisión, la cadena de saldos del superusuario nace "de la nada": el primer asiento de venta partiría de un saldo que el log nunca explica. Es lo que hace que la cadena sea completa de punta a punta, y es lo que la descripción pide explícitamente ("sin excepciones").

**Independent Test**: Provisionar la liquidez inicial del superusuario sobre una base vacía con jugadores en el catálogo y verificar que cada tenencia emitida tiene un asiento de tipo CREDIT por 100, con saldo anterior 0 y posterior 100, y que el saldo de la tenencia coincide con el posterior.

**Acceptance Scenarios**:

1. **Given** una base limpia con jugadores en el catálogo y un superusuario recién creado, **When** el sistema provisiona la liquidez inicial, **Then** cada jugador provisionado deja un asiento CREDIT de 100 con saldo anterior 0 y saldo posterior 100.
2. **Given** la liquidez ya provisionada, **When** el sistema arranca de nuevo, **Then** no se emite ni se audita nada otra vez (se mantiene el comportamiento actual: la emisión es idempotente, un asiento por emisión real).
3. **Given** la emisión de un jugador que falla a mitad de camino, **When** se descarta, **Then** no queda ni tenencia ni asiento de esa emisión (una emisión no puede cambiar el saldo sin dejar su asiento, ni dejar el asiento sin cambiar el saldo).
4. **Given** el primer movimiento posterior de ese superusuario (por ejemplo una venta de 10 de ese jugador), **When** se registra su asiento, **Then** parte del saldo 100 que dejó la emisión (saldo anterior 100, posterior 90): la cadena empalma sin huecos.

---

### User Story 3 - Los asientos históricos se completan con una migración única (Priority: P2)

El equipo necesita que los asientos creados antes de esta feature (que no tienen los dos saldos) no queden como una excepción permanente, de modo que la auditoría sea homogénea y la regla de la constitución valga para toda operación, pasada o futura.

**Why this priority**: Es P2 porque las historias 1 y 2 ya dejan bien todo lo nuevo; esto salda el pasado y es una operación de una sola vez con su propio riesgo.

**Independent Test**: Sobre una base con asientos antiguos sin saldos (varios usuarios, varios jugadores, con compras y ventas intercaladas), correr la migración y verificar que cada asiento antiguo trae un saldo anterior y uno posterior, que cada cadena es continua y que el último saldo posterior de cada tenencia coincide con su saldo actual.

**Acceptance Scenarios**:

1. **Given** el historial de una tenencia con movimientos CREDIT y DEBIT en distintos momentos, **When** corre la migración, **Then** cada asiento recibe su saldo anterior y posterior recorriendo el historial en orden cronológico, y el anterior de cada uno es el posterior del que lo precede.
2. **Given** una tenencia cuyo primer asiento registrado no parte de cero porque parte de los tokens provino de una emisión que nunca se auditó (el superusuario), **When** corre la migración, **Then** el punto de partida de esa tenencia es la cantidad con la que ya contaba antes de su primer asiento registrado (ver Decisión de diseño y Assumptions), no cero, y ningún saldo reconstruido es negativo.
3. **Given** asientos que ya tienen los dos saldos (los creados por las historias 1 y 2), **When** corre la migración, **Then** no se toca ninguno: la migración sólo completa campos vacíos y nunca sobrescribe un valor existente.
4. **Given** la migración ya aplicada, **When** se la vuelve a ejecutar, **Then** no cambia nada (es idempotente).
5. **Given** una tenencia cuya historia reconstruida no coincide con su saldo real (porque falta un movimiento en el log, o por datos sembrados) o produciría un saldo negativo, **When** corre la operación, **Then** NO se inventan ni persisten valores para esa tenencia: sus asientos quedan sin completar, las demás tenencias sí se completan, se informan todas las inconsistentes con su causa y la operación termina señalando el fallo en lugar de dar un éxito silencioso.
6. **Given** la operación terminada sin tenencias inconsistentes, **When** se consulta la auditoría, **Then** ya no existe ningún asiento sin saldo anterior y posterior, y queda habilitado el paso posterior que vuelve obligatorios esos dos datos para todo asiento.
7. **Given** varios asientos de una misma tenencia con exactamente el mismo instante (un mismo cruce con varias contrapartes, o un auto-cruce), **When** corre la migración, **Then** se ordenan con una regla determinista y documentada (los CREDIT antes que los DEBIT), de modo que dos corridas sobre los mismos datos dan el mismo resultado.

---

### Edge Cases

- **Emisión inicial histórica sin asiento**: es el caso que invalida el supuesto de "historial completo" para el superusuario. Los tokens que emitió el sistema antes de esta feature no figuran en el log; se cubren con la regla del punto de partida (US3, escenario 2), no con asientos inventados.
- **Siembra de datos de simulación**: el comando de simulación fija cantidades de tenencias de forma absoluta y arma asientos con valores propios, que no tienen por qué sumar la cantidad final. No es un movimiento por crédito/débito y queda fuera de la regla de captura; para la migración, las tenencias de datos simulados que resulten irreconstruibles siguen la regla del escenario 5.
- **Auto-cruce** (mismo usuario comprador y vendedor): dos asientos sobre la misma tenencia con el mismo instante; el CREDIT se aplica primero (US1, escenario 5).
- **Órdenes concurrentes sobre la misma tenencia**: el saldo anterior de cada asiento es el que realmente tenía la tenencia al aplicarse el movimiento; las operaciones que ya se serializan hoy para no pisarse siguen haciéndolo, y la cadena resultante es continua.
- **Cancelación de una orden**: no mueve tokens, por lo tanto no genera asiento ni saldo (sin cambios).
- **Tenencia llevada a cero**: un DEBIT que deja la tenencia en 0 queda con saldo posterior 0 (válido); un saldo negativo nunca es válido.
- **Usuario sin asientos**: la migración no hace nada para él.
- **Base vacía**: la migración termina sin cambios ni errores.
- **Respuesta del historial de operaciones**: no cambia (ver Fuera de alcance).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada asiento de auditoría de tokens MUST registrar, además de sus datos actuales, el **saldo anterior** y el **saldo posterior** de esa tenencia (ese usuario, ese jugador) respecto del movimiento que lo originó.
- **FR-002**: Esos dos saldos MUST capturarse en el momento en que se aplica el movimiento, a partir del saldo que la tenencia tenía justo antes y del que tiene justo después, y MUST NOT recalcularse luego a partir del historial.
- **FR-003**: Para todo asiento nuevo, el saldo posterior MUST ser igual al anterior más la cantidad (CREDIT) o menos la cantidad (DEBIT), y ninguno de los dos saldos puede ser negativo.
- **FR-004**: La regla aplica a **todo** movimiento que cambie una tenencia por crédito o débito, sin excepciones, sea cual sea su origen (ejecución de una orden o emisión inicial).
- **FR-005**: La emisión inicial de tokens al superusuario MUST generar su propio asiento de auditoría (CREDIT por la cantidad emitida, saldo anterior 0, saldo posterior igual a la cantidad emitida). Ese asiento no tiene orden ni orden contraparte, porque la emisión no nace de ninguna orden ni hay otro usuario en la operación; se lo reconoce justamente por no tener orden.
- **FR-006**: La emisión inicial y su asiento MUST aplicarse como una unidad atómica con la tenencia que modifican: o quedan los dos o no queda ninguno (Principio VI).
- **FR-007**: La emisión inicial MUST seguir siendo idempotente: una tenencia ya emitida no se vuelve a emitir ni a auditar.
- **FR-008**: Cuando una misma operación mueve varias veces la misma tenencia (varias contrapartes, auto-cruce), cada asiento MUST partir del saldo que dejó el anterior, de modo que la cadena de saldos sea continua.
- **FR-009**: Para cada tenencia, el saldo anterior de cada asiento MUST coincidir con el saldo posterior del asiento que lo precede, y el saldo posterior del último MUST coincidir con la cantidad actual de la tenencia (tanto para asientos nuevos como, tras la migración, para los históricos reconstruidos).
- **FR-010**: Los asientos de auditoría ya existentes MUST completarse con una operación de una sola vez (un script de mantenimiento que se corre explícitamente por entorno y que se puede volver a correr sin riesgo) que recorra, para cada tenencia, su historial en orden cronológico y asigne a cada asiento su saldo anterior y posterior.
- **FR-011**: El punto de partida de la reconstrucción de una tenencia MUST ser cero, salvo para las tenencias del superusuario que nacieron de la emisión inicial anterior a esta feature (que nunca se auditó): para esas el punto de partida válido es también la cantidad emitida. Ninguna otra cantidad de partida es válida. Ver Decisión de diseño.
- **FR-012**: La reconstrucción de una tenencia MUST validarse contra su saldo real: el saldo posterior del último asiento reconstruido tiene que coincidir con la cantidad actual de la tenencia (o, si la tenencia ya tiene asientos con saldo capturados por el sistema nuevo, el primero de ellos tiene que partir de ese saldo), y ningún saldo reconstruido puede ser negativo. Si la validación falla, la operación MUST NOT inventar ni persistir valores para esa tenencia: sus asientos quedan sin completar, se informan todas las tenencias inconsistentes juntas con su causa, las tenencias válidas sí se completan, y la operación termina señalando el fallo (no en silencio).
- **FR-013**: La migración MUST NOT crear asientos nuevos ni modificar ningún dato de los asientos existentes salvo completar los dos saldos vacíos, y MUST NOT sobrescribir un valor ya presente.
- **FR-014**: La migración MUST ser idempotente y determinista: volver a ejecutarla, o ejecutarla dos veces sobre los mismos datos, produce el mismo resultado. Los asientos con el mismo instante dentro de una tenencia se ordenan con una regla fija (CREDIT antes que DEBIT) que queda documentada.
- **FR-015**: Una vez verificado en cada entorno que no quedan asientos pendientes, el saldo anterior y el posterior MUST pasar a ser obligatorios para todo asiento, de modo que no puedan existir asientos nuevos sin ellos. Este endurecimiento es un paso posterior y separado de la captura y de la completación de los históricos.
- **FR-016**: Un asiento de auditoría, una vez creado y completo, MUST seguir siendo inmutable: la única modificación permitida sobre un asiento es la de esta migración, que sólo llena campos que estaban vacíos (ver Decisión de diseño).
- **FR-017**: La respuesta del historial de operaciones del usuario y el resto de los contratos de la API MUST NOT cambiar por esta feature. En particular, el asiento de emisión inicial no aparece en el historial de operaciones ni se incorpora al costo promedio de compra del portafolio: ambos siguen calculándose sólo con operaciones de compraventa.
- **FR-018**: La decisión de completar los históricos con una migración, en lugar de dejarlos vacíos, y la regla del punto de partida MUST quedar documentadas con su justificación (ver "Decisión de diseño").

### Key Entities

- **Asiento de auditoría de tokens**: registro append-only de un movimiento de una tenencia. Mantiene lo que ya tenía (usuario, tipo CREDIT/DEBIT, jugador, cantidad, precio, instante, orden y orden contraparte) y suma el **saldo anterior** y el **saldo posterior** de la tenencia. El asiento de emisión inicial es un asiento más, sin orden contraparte.
- **Tenencia (usuario, jugador)**: cantidad de tokens de un jugador que posee un usuario. Es la fuente del saldo anterior y posterior de cada asiento.
- **Cadena de saldos**: la secuencia de asientos de una misma tenencia en orden cronológico, en la que cada saldo anterior es el posterior del asiento precedente y el último posterior es la cantidad actual.

## Decisión de diseño

**Se completan los asientos históricos con una migración de backfill, en lugar de dejarlos con los saldos vacíos.**

- **Qué se decidió**: una migración única recorre el historial de cada tenencia y completa el saldo anterior y posterior de cada asiento existente. Los asientos nuevos nunca pasan por esta reconstrucción: capturan el saldo en el momento. Terminada la migración, los dos campos son obligatorios.
- **Por qué**: el Principio V exige estado anterior y posterior para "toda operación", sin distinguir pasada de futura. Como el log es append-only, el saldo en cualquier punto del historial se obtiene sin ambigüedad a partir de los movimientos anteriores de esa tenencia; dejarlo vacío sería mantener una excepción permanente en la auditoría que se puede cerrar.
- **Por qué el punto de partida no siempre es cero (hallazgo del código)**: la premisa de que el log contiene todos los movimientos de una tenencia no se cumple para la emisión inicial al superusuario. Hoy ese movimiento cambia la tenencia pero no deja ningún asiento (un asiento exige una orden y una orden contraparte). Si la migración partiera siempre de cero, **cada** asiento del superusuario quedaría con saldos erróneos por exactamente la cantidad emitida, y sin ninguna señal de error mientras el saldo no cruzara a negativo. Por eso la regla de partida es explícita (FR-011) en lugar de implícita.
- **Qué se evita**: no se agregan asientos retroactivos para la emisión histórica (se inventaría un instante y una autoría que el log no tiene, y el log dejaría de ser sólo lo que ocurrió y se registró). La emisión histórica queda representada como la cantidad inicial de la cadena, y la emisión futura sí queda auditada con asiento propio (US2).
- **Tensión con la inmutabilidad (Principio V)**: la migración modifica filas existentes del log, cosa que el principio prohíbe en general. Se justifica como excepción acotada y de una sola vez: sólo pasa de "vacío" a "con valor", nunca cambia ni borra un dato ya registrado, no crea ni quita asientos, y es idempotente. Tras el paso posterior que vuelve obligatorios los campos, la excepción no se puede repetir. La excepción debe quedar registrada en la verificación de la constitución del plan de implementación.

## Fuera de alcance, aceptado como riesgo

- **El historial puede no ser completo**: la migración asume que el historial existente está completo y ordenado cronológicamente para cada tenencia, salvo la emisión inicial que esta spec sí trata (FR-011). Si algún otro movimiento no quedó registrado en el pasado (por ejemplo, por un defecto ya corregido), la reconstrucción hereda ese error en silencio.
- **Validación cruzada limitada al saldo neto**: la validación de FR-012 detecta cualquier desfasaje entre el historial y el saldo real, pero no puede detectar movimientos faltantes que se compensen exactamente entre sí (por ejemplo, un crédito y un débito iguales que no quedaron registrados). Ese riesgo residual se acepta.
- **Exposición de los saldos**: esta feature sólo registra los saldos. La respuesta del historial de operaciones no los muestra (FR-017); hacerlo es una decisión de contrato aparte.
- **La siembra de simulación** (que fija cantidades absolutas) no se convierte en movimientos auditados: no pasa por crédito/débito.
- Tampoco se incluye: auditar tenencias del resto de los usuarios por fuera de las operaciones, corrección de datos inconsistentes, y cambios de frontend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los asientos creados tras esta feature (por ejecución de órdenes y por emisión) trae saldo anterior y posterior, y en el 100% se cumple que posterior = anterior ± cantidad con ambos saldos no negativos.
- **SC-002**: Para el 100% de las tenencias con operaciones posteriores a esta feature, la cadena de saldos es continua (cada anterior es el posterior del precedente) y el último saldo posterior coincide con la cantidad actual de la tenencia.
- **SC-003**: Provisionar la liquidez inicial sobre una base limpia deja un asiento de emisión por cada jugador provisionado (saldo 0 → 100), y reiniciar el sistema no agrega ninguno.
- **SC-004**: Tras la migración, el 100% de los asientos históricos de tenencias reconstruibles trae saldo anterior y posterior, con cadena continua y último saldo igual a la cantidad actual; las tenencias no reconstruibles (si las hay) quedan identificadas en el informe de la migración, y ninguna queda con un saldo negativo.
- **SC-005**: Ejecutar la migración una segunda vez no modifica ni un solo asiento, y ejecutarla dos veces sobre una misma copia de los datos produce resultados idénticos.
- **SC-006**: Ningún asiento existente cambia otro dato que no sean sus dos saldos vacíos, y el número de asientos antes y después de la migración es el mismo.
- **SC-007**: Una operación o una emisión que se descarta por error deja cero asientos y cero cambios de tenencia.
- **SC-008**: Los contratos de la API (incluida la respuesta del historial de operaciones) son idénticos antes y después de la feature.

## Assumptions

- **El Principio V ya se cumple en espíritu para el detalle del cambio** (cantidad, precio, órdenes); esta feature agrega la pieza que falta: el estado anterior y posterior como campos propios y no inferidos.
- **Quién es el "autor"**: el asiento ya identifica al usuario titular de la tenencia que cambia; no se agrega ningún campo de autoría.
- **Punto de partida de las tenencias antiguas** (ajustado tras el plan del equipo): la spec original proponía derivarlo de la cantidad actual; el plan incorporó en cambio una validación cruzada contra el saldo real, y esta spec se alineó con él. El punto de partida es cero salvo el caso conocido de la emisión del superusuario (FR-011); cualquier otro desfasaje es una inconsistencia que se reporta, no un valor que se acepte.
- **Identificación del superusuario**: se lo reconoce por su nombre de usuario reservado, que ningún otro usuario puede registrar.
- **Cuándo se endurece la obligatoriedad** (FR-015): después de una corrida limpia en cada entorno; en los entornos con datos de simulación antiguos puede requerir limpiar esos datos primero.
- **Datos de simulación**: se asume que el entorno de desarrollo con datos sembrados por el comando de simulación puede tener tenencias irreconstruibles; es esperable y no bloquea la entrega (FR-012).
- **Orden de desempate**: el log no guarda un número de secuencia; para los asientos con el mismo instante se asume CREDIT antes que DEBIT, que es el orden real con el que el sistema los aplica. Entre asientos del mismo tipo y el mismo instante en una misma tenencia, el saldo final de la tenencia es el mismo; los saldos intermedios individuales de esos asientos se asignan con un orden estable y quedan documentados como una aproximación de los históricos.
- **Una sola instancia de la base**: la migración corre una vez por entorno, al desplegar, y no necesita ejecutarse en paralelo con tráfico de órdenes (se asume una ventana de despliegue o que las órdenes en curso no cambian el historial que ya se recorrió).
- **Dependencias**: `020-order-matching-engine` (asientos, tenencias y la liquidez inicial del superusuario). No requiere cambios de frontend.
- **Documentación (Principios VIII y X)**: no cambia ningún endpoint, por lo que Swagger y Postman no cambian; sí debe documentarse la migración y la decisión de diseño.
