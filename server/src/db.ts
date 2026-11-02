import { MongoClient, MongoNetworkError, MongoServerSelectionError, Db } from 'mongodb';
import type { FriendshipDoc, HackathonDoc, InviteDoc, ProjectDoc, UserDoc } from './models.js';
import type { TokenDoc } from './tokens.js';
import { env } from './env.js';

// One client for the whole process
const globalForMongo: {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoIndexesReady?: Promise<void>;
} = {};

function getClient(): Promise<MongoClient> {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
  }
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 5000 }).connect();
    // Let a later request retry if the first connection attempt fails
    globalForMongo._mongoClientPromise.catch(() => {
      globalForMongo._mongoClientPromise = undefined;
    });
  }
  return globalForMongo._mongoClientPromise;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection<UserDoc>('users').createIndex({ email: 1 }, { unique: true }),
    db.collection<UserDoc>('users').createIndex({ googleId: 1 }, { unique: true, sparse: true }),
    db.collection<UserDoc>('users').createIndex({ handle: 1 }, { unique: true, sparse: true }),
    db.collection<HackathonDoc>('hackathons').createIndex({ ownerId: 1, createdAt: -1 }),
    db.collection<HackathonDoc>('hackathons').createIndex({ memberIds: 1 }),
    db.collection<TokenDoc>('tokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<TokenDoc>('tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<InviteDoc>('invites').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<InviteDoc>('invites').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<InviteDoc>('invites').createIndex({ inviteeUserId: 1 }, { sparse: true }),
    db.collection<FriendshipDoc>('friendships').createIndex({ pairKey: 1 }, { unique: true }),
    db.collection<FriendshipDoc>('friendships').createIndex({ requesterId: 1, status: 1 }),
    db.collection<FriendshipDoc>('friendships').createIndex({ addresseeId: 1, status: 1 }),
    db.collection<ProjectDoc>('projects').createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection<ProjectDoc>('projects').createIndex({ memberIds: 1 }),
    db.collection<ProjectDoc>('projects').createIndex({ hackathonId: 1 }),
    db.collection<ProjectDoc>('projects').createIndex({ 'pendingInvites.userId': 1 }),
    // TTL indexes: only documents that have expiresAt (demo data) are removed, once that time passes
    db.collection<UserDoc>('users').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<HackathonDoc>('hackathons').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<ProjectDoc>('projects').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

/** True when the error means MongoDB could not be reached at all */
export function isDbUnreachable(err: unknown) {
  return err instanceof MongoServerSelectionError || err instanceof MongoNetworkError;
}

/** MONGODB_URI with any password hidden, for log messages */
export function describeMongoUri() {
  return (env.mongoUri ?? '(not set)').replace(/\/\/([^:/@]+):[^@]+@/, '//$1:****@');
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(env.mongoDb);
  if (!globalForMongo._mongoIndexesReady) {
    globalForMongo._mongoIndexesReady = ensureIndexes(db);
  }
  await globalForMongo._mongoIndexesReady;
  return db;
}

export async function collections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>('users'),
    hackathons: db.collection<HackathonDoc>('hackathons'),
    tokens: db.collection<TokenDoc>('tokens'),
    invites: db.collection<InviteDoc>('invites'),
    friendships: db.collection<FriendshipDoc>('friendships'),
    projects: db.collection<ProjectDoc>('projects'),
  };
}
