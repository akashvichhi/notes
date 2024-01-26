export const snakeCase = (str: string) => {
  return str
    .replace(/([A-Z])/g, (match: string) => `_${match.toLowerCase()}`)
    .trim();
};

export const camelCase = (str: string) => {
  return str.replace(/_([a-zA-Z])/g, (match: string) => match[1].toUpperCase());
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const snakeToCamel = (input: any): any => {
  if (!input || typeof input === "string") return input;

  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return input.map((item: any) => snakeToCamel(item));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const key in input) {
    obj[camelCase(key)] = snakeToCamel(input[key]);
  }
  return obj;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const camelToSnake = (input: any): any => {
  if (!input || typeof input === "string") return input;

  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return input.map((item: any) => camelToSnake(item));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const key in input) {
    obj[snakeCase(key)] = camelToSnake(input[key]);
  }
  return obj;
};
