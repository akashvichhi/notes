"""JSON values with real types, for data the API passes through without a schema
(ProseMirror note bodies)."""

type JsonValue = str | int | float | bool | list[JsonValue] | dict[str, JsonValue] | None
type JsonObject = dict[str, JsonValue]
