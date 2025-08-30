const mongoose = require('mongoose');
const { migrateOrderSnapshots, checkMigrationStatus } = require('../utils/migrateOrderSnapshots');
require('dotenv').config();

/**
 * Script to run the order snapshot migration
 * Usage: node scripts/runOrderMigration.js
 */

const runMigration = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Check current status
    console.log('\n=== BEFORE MIGRATION ===');
    await checkMigrationStatus();

    // Run migration
    console.log('\n=== RUNNING MIGRATION ===');
    const result = await migrateOrderSnapshots();

    // Check status after migration
    console.log('\n=== AFTER MIGRATION ===');
    await checkMigrationStatus();

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Successfully migrated: ${result.migratedCount} orders`);
    console.log(`Errors encountered: ${result.errorCount} orders`);

    if (result.errorCount === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with some errors. Check logs for details.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the migration
runMigration();