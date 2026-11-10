/** Una muestra del formato de texto de Prometheus: `nombre{etiquetas} valor`. */
export interface PromSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

const SAMPLE_LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)$/;
const LABEL_PAIR = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

/** Parsea el texto de `GET /metrics` (ignora los comentarios `# HELP` y `# TYPE`). */
export function parsePrometheusText(text: string): PromSample[] {
  const samples: PromSample[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const match = SAMPLE_LINE.exec(trimmed);
    if (!match) throw new Error(`Línea de métricas inválida: ${trimmed}`);
    const labels: Record<string, string> = {};
    for (const pair of (match[2] ?? '').matchAll(LABEL_PAIR)) {
      labels[pair[1]] = pair[2].replace(/\\(["\\])/g, '$1').replace(/\\n/g, '\n');
    }
    samples.push({ name: match[1], labels, value: Number(match[3]) });
  }
  return samples;
}

/** Valor de la muestra `name` cuyas etiquetas son exactamente `labels`; `undefined` si no existe. */
export function sampleValue(
  samples: PromSample[],
  name: string,
  labels: Record<string, string>,
): number | undefined {
  const wanted = Object.entries(labels);
  const found = samples.find(
    (s) =>
      s.name === name &&
      Object.keys(s.labels).length === wanted.length &&
      wanted.every(([k, v]) => s.labels[k] === v),
  );
  return found?.value;
}

/** Cantidad de series (combinaciones de etiquetas distintas) de la muestra `name`. */
export function seriesCount(samples: PromSample[], name: string): number {
  return new Set(
    samples.filter((s) => s.name === name).map((s) => JSON.stringify(Object.entries(s.labels).sort())),
  ).size;
}

/** Nombres de las familias declaradas con `# TYPE`. */
export function familyNames(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('# TYPE '))
    .map((line) => line.split(' ')[2]);
}
