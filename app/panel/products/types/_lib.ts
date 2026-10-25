/** A product type as the types page loads it. */

export type ProductTypeRow = {
  id: string;
  key: string;
  name: string;
  pluralName: string;
  description: string | null;
  listPath: string | null;
  position: number;
  products: number;
  createdAt: string;
  updatedAt: string;
};
