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
  if (!input) return input;

  if (typeof input === "string") {
    return camelCase(input);
  }

  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return input.map((item: any) => snakeToCamel(item));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const value in input) {
    obj[camelCase(value)] = input[value];
  }
  return obj;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const camelToSnake = (input: any): any => {
  if (!input) return input;

  if (typeof input === "string") {
    return snakeCase(input);
  }

  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return input.map((item: any) => camelToSnake(item));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const value in input) {
    obj[snakeCase(value)] = input[value];
  }
  return obj;
};
