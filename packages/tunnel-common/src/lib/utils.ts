export function hasCode<T>(value: T): value is T & { code: string } {
  return value && typeof (value as any).code === 'string';
}
