import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export type GameFilters = {
    categoryIds?: number[];
    publisherIds?: number[];
};

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function normalizeFilterIds(values?: number[] | null): number[] | undefined {
    if (!values || values.length === 0) {
        return undefined;
    }

    const uniqueValues = [...new Set(values.filter((value) => Number.isFinite(value)))];
    return uniqueValues.length > 0 ? uniqueValues : undefined;
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const categoryIds = normalizeFilterIds(filters.categoryIds);
    const publisherIds = normalizeFilterIds(filters.publisherIds);
    const filterConditions = [];

    if (categoryIds && categoryIds.length > 0) {
        filterConditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds && publisherIds.length > 0) {
        filterConditions.push(inArray(games.publisherId, publisherIds));
    }

    const query =
        filterConditions.length > 0 ? baseGamesQuery(db).where(and(...filterConditions)) : baseGamesQuery(db);

    const rows = await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const categoryIds = normalizeFilterIds(filters.categoryIds);
    const publisherIds = normalizeFilterIds(filters.publisherIds);
    const filterConditions = [];

    if (categoryIds && categoryIds.length > 0) {
        filterConditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds && publisherIds.length > 0) {
        filterConditions.push(inArray(games.publisherId, publisherIds));
    }

    const query =
        filterConditions.length > 0
            ? db.select({ id: games.id }).from(games).where(and(...filterConditions))
            : db.select({ id: games.id }).from(games);

    const rows = await query.orderBy(asc(games.title));
    return rows.map((row: { id: number }) => row.id);
}

export type GameListItem = {
    id: number;
    name: string;
};

export async function getAllCategories(db: Database): Promise<GameListItem[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows;
}

export async function getAllPublishers(db: Database): Promise<GameListItem[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows;
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
