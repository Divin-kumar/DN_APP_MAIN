import Dexie from 'dexie';
import { DATABASE_SCHEMA, DATABASE_SCHEMA_VERSION } from './schema.js';

class LifeHubDatabase extends Dexie {
  constructor() {
    super('lifehub-dexie-db');
    this.version(DATABASE_SCHEMA_VERSION).stores(DATABASE_SCHEMA);
  }
}

export const db = new LifeHubDatabase();

export const openDatabase = async () => db.open();

export const closeDatabase = async () => db.close();
