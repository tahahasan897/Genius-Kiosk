import { query } from './db.js';

async function fixConstraint() {
    try {
        console.log('Attempting to drop constraint...');
        await query(`ALTER TABLE store_map_elements DROP CONSTRAINT IF EXISTS store_map_elements_element_type_check;`);
        console.log('Constraint dropped successfully (if it existed).');
        process.exit(0);
    } catch (err) {
        console.error('Error dropping constraint:', err);
        process.exit(1);
    }
}

fixConstraint();
