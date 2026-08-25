export class DiaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiaryValidationError';
  }
}

export class DiaryNotFoundError extends Error {
  constructor(entity: 'daily context' | 'factor' | 'meal' | 'symptom event') {
    super(`The requested ${entity} was not found in this diary.`);
    this.name = 'DiaryNotFoundError';
  }
}

export class DiaryIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiaryIntegrityError';
  }
}

