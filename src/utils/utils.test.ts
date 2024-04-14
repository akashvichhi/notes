import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { camelToSnake, snakeToCamel, trimHTML } from "./utils";

afterEach(() => {
  cleanup;
});

describe("snakeToCamel", () => {
  it("returns the input if it is not an object", () => {
    expect(snakeToCamel(5)).toEqual(5);
    expect(snakeToCamel("string")).toEqual("string");
    expect(snakeToCamel(null)).toEqual(null);
  });

  it("converts snake case keys to camel case", () => {
    const input = {
      first_name: "John",
      last_name: "Doe",
      contact_info: {
        email_address: "john.doe@example.com",
      },
    };
    const expectedOutput = {
      firstName: "John",
      lastName: "Doe",
      contactInfo: {
        emailAddress: "john.doe@example.com",
      },
    };
    expect(snakeToCamel(input)).toEqual(expectedOutput);
  });

  it("handles an array of objects", () => {
    const input = [{ first_name: "John" }, { last_name: "Doe" }];
    const expectedOutput = [{ firstName: "John" }, { lastName: "Doe" }];
    expect(snakeToCamel(input)).toEqual(expectedOutput);
  });
});

describe("camelToSnake", () => {
  it("returns the input if it is not an object", () => {
    expect(camelToSnake(5)).toEqual(5);
    expect(camelToSnake("string")).toEqual("string");
    expect(camelToSnake(null)).toEqual(null);
  });

  it("converts camel case keys to snake case", () => {
    const input = {
      firstName: "John",
      lastName: "Doe",
      contactInfo: {
        emailAddress: "john.doe@example.com",
      },
    };
    const expectedOutput = {
      first_name: "John",
      last_name: "Doe",
      contact_info: {
        email_address: "john.doe@example.com",
      },
    };
    expect(camelToSnake(input)).toEqual(expectedOutput);
  });

  it("handles an array of objects", () => {
    const input = [{ firstName: "John" }, { lastName: "Doe" }];
    const expectedOutput = [{ first_name: "John" }, { last_name: "Doe" }];
    expect(camelToSnake(input)).toEqual(expectedOutput);
  });
});

describe("trimHTML", () => {
  it("removes HTML tags properly", () => {
    const input = "<p>Hello <strong>World</strong></p>";
    const expectedOutput = "Hello World";
    expect(trimHTML(input)).toEqual(expectedOutput);
  });

  it("replaces &nbsp; with a space", () => {
    const input = "Hello&nbsp;World";
    const expectedOutput = "Hello World";
    expect(trimHTML(input)).toEqual(expectedOutput);
  });

  it("replaces multiple whitespaces with a single space", () => {
    const input = "Hello    World";
    const expectedOutput = "Hello World";
    expect(trimHTML(input)).toEqual(expectedOutput);
  });

  it("trims leading and trailing spaces", () => {
    const input = "   Hello World   ";
    const expectedOutput = "Hello World";
    expect(trimHTML(input)).toEqual(expectedOutput);
  });
});
