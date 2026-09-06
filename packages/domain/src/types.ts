export type Category = 'champion' | 'component';

export type CatalogEntry = {
  id: string;
  name: string;
  category: Category;
  icon: string;
};

export type PriorityLists = {
  champions: string[];
  components: string[];
};

export type ValidationError = {
  ok: false;
  code: 'too_many' | 'duplicate' | 'unknown' | 'wrong_category';
  index?: number;
};

export type ValidationResult<T = string[]> =
  | { ok: true; value: T }
  | ValidationError;
