/** The pagination every list endpoint shares (docs/standards/api-contract.md). */

export interface IPaginationParams {
  page?:    number
  perPage?: number
}

export interface IPaginationMeta {
  totalCount:  number
  currentPage: number
  perPage:     number
  totalPages:  number
}

export interface IPaginatedResponse<T> {
  data: T[]
  meta: IPaginationMeta
}
