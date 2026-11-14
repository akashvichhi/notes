from dataclasses import dataclass


@dataclass(frozen=True)
class CreateResult[ResourceT]:
    """What a create with a client-chosen uuid returns: a retry after a lost response
    finds the record the first attempt made instead of failing."""

    resource: ResourceT
    created: bool
