import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<{
    strategyId: number;
    puzzleId: number;
    codeForgeId: number;
    devMastersId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'puzzle' })
        .returning({ id: categories.id });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'codeforge' })
        .returning({ id: publishers.id });
    const [devMasters] = await db
        .insert(publishers)
        .values({ name: 'DevMasters Inc.', description: 'devmasters' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Tactics',
            description: 'Alpha strategy title',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Beta Tactics',
            description: 'Beta strategy title',
            starRating: 4.3,
            categoryId: strategy.id,
            publisherId: devMasters.id,
        },
        {
            title: 'Gamma Riddle',
            description: 'Gamma puzzle title',
            starRating: 4.5,
            categoryId: puzzle.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Delta Riddle',
            description: 'Delta puzzle title',
            starRating: 4.1,
            categoryId: puzzle.id,
            publisherId: devMasters.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        puzzleId: puzzle.id,
        codeForgeId: codeForge.id,
        devMastersId: devMasters.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by category', async () => {
        const { strategyId } = await seedFilteredGames(db);
        const filtered = await getAllGames(db, { categoryIds: [strategyId] });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha Tactics', 'Beta Tactics']);
    });

    it('filters games by publisher', async () => {
        const { codeForgeId } = await seedFilteredGames(db);
        const filtered = await getAllGames(db, { publisherIds: [codeForgeId] });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha Tactics', 'Gamma Riddle']);
    });

    it('combines category and publisher filters', async () => {
        const { strategyId, codeForgeId } = await seedFilteredGames(db);
        const filtered = await getAllGames(db, {
            categoryIds: [strategyId],
            publisherIds: [codeForgeId],
        });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha Tactics']);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
