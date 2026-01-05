const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  database: 'JubileeVerse',
  user: 'guardian',
  password: process.env.DB_PASSWORD
});

async function run() {
  try {
    // Get the collection id
    const collection = await pool.query(`
      SELECT id, slug FROM flywheel_collections WHERE slug = 'market-data'
    `);
    console.log('Collection:', collection.rows[0]);

    const collectionId = collection.rows[0].id;

    // Try direct insert
    console.log('\nInserting 8 roots for market-data...');
    const result = await pool.query(`
      INSERT INTO flywheel_collection_categories (
        collection_id,
        slug,
        name,
        display_name,
        description,
        level,
        display_order,
        icon,
        icon_color,
        is_active,
        is_expandable
      ) VALUES
        ($1, 'prices', 'Prices', 'Prices', 'Real-time and historical price data', 1, 1, 'trending-up', '#81c784', TRUE, TRUE),
        ($1, 'volume', 'Volume', 'Volume', 'Trading volume metrics', 1, 2, 'bar-chart-2', '#81c784', TRUE, TRUE),
        ($1, 'orderbook', 'OrderBook', 'Order Book', 'Order book depth', 1, 3, 'layers', '#81c784', TRUE, TRUE),
        ($1, 'trades', 'Trades', 'Trades', 'Tick-level trade data', 1, 4, 'activity', '#81c784', TRUE, TRUE),
        ($1, 'volatility', 'Volatility', 'Volatility', 'Realized and implied volatility', 1, 5, 'zap', '#81c784', TRUE, TRUE),
        ($1, 'liquidity', 'Liquidity', 'Liquidity', 'Bid-ask spreads and liquidity', 1, 6, 'droplet', '#81c784', TRUE, TRUE),
        ($1, 'technical-indicators', 'TechnicalIndicators', 'Technical Indicators', 'Moving averages and oscillators', 1, 7, 'sliders', '#81c784', TRUE, TRUE),
        ($1, 'market-structure', 'MarketStructure', 'Market Structure', 'Market microstructure data', 1, 8, 'grid', '#81c784', TRUE, TRUE)
      RETURNING id, slug
    `, [collectionId]);

    console.log('Inserted:', result.rows.length, 'rows');
    result.rows.forEach(r => console.log('  -', r.slug));

    // Verify count
    const count = await pool.query(`
      SELECT COUNT(*) as cnt FROM flywheel_collection_categories WHERE collection_id = $1
    `, [collectionId]);
    console.log('\nTotal roots for market-data:', count.rows[0].cnt);

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}
run();
