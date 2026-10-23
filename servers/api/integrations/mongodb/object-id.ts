import mongoose from "mongoose";
import type { Types } from "mongoose";

export type MongoObjectId = Types.ObjectId;

const ObjectIdConstructor = mongoose.Types.ObjectId as unknown as new (value: string) => MongoObjectId;

export const isObjectIdString = (value: string): boolean => /^[\da-f]{24}$/i.test(value);

export const objectIdFromString = (value: string): MongoObjectId => new ObjectIdConstructor(value);

export const objectIdToString = (value: MongoObjectId): string => value.toString();
