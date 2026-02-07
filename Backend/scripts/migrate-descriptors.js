/**
 * Migration Script: Backfill faceDescriptors from legacy faceDescriptor
 * 
 * This script finds all students that have a legacy faceDescriptor but no
 * faceDescriptors array, and copies the legacy descriptor into the new array format.
 * 
 * Usage:
 *   cd Backend
 *   node scripts/migrate-descriptors.js
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --verbose    Show detailed output for each student
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");

// Import database connection and models
const connectDB = require("../db");

// Define Student model inline to avoid circular dependencies
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  image: { type: String },
  faceDescriptors: { type: [[Number]], default: [] },
  faceDescriptor: { type: [Number] },
  descriptorCount: { type: Number, default: 0 },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
  dateAdded: { type: Date, default: Date.now },
});

async function migrate() {
  console.log("=".repeat(60));
  console.log("Face Descriptor Migration Script");
  console.log("=".repeat(60));
  
  if (dryRun) {
    console.log("\n[DRY RUN MODE] - No changes will be made\n");
  }

  try {
    // Connect to database
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Connected successfully!\n");

    // Get the Student model (use existing if already registered)
    let Student;
    try {
      Student = mongoose.model("Student");
    } catch {
      Student = mongoose.model("Student", studentSchema);
    }

    // Find students that need migration:
    // - Have a legacy faceDescriptor (array with values)
    // - Don't have faceDescriptors OR faceDescriptors is empty
    const studentsToMigrate = await Student.find({
      faceDescriptor: { $exists: true, $not: { $size: 0 } },
      $or: [
        { faceDescriptors: { $exists: false } },
        { faceDescriptors: { $size: 0 } }
      ]
    });

    console.log(`Found ${studentsToMigrate.length} student(s) needing migration\n`);

    if (studentsToMigrate.length === 0) {
      console.log("Nothing to migrate. All students already have faceDescriptors.");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Show summary
    console.log("Students to migrate:");
    console.log("-".repeat(50));
    for (const student of studentsToMigrate) {
      const descriptorLength = student.faceDescriptor?.length || 0;
      console.log(`  ${student.rollNumber}: ${student.name} (descriptor size: ${descriptorLength})`);
    }
    console.log("-".repeat(50));
    console.log("");

    if (dryRun) {
      console.log("[DRY RUN] Would migrate the above students.");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Perform migration
    let successCount = 0;
    let errorCount = 0;

    for (const student of studentsToMigrate) {
      try {
        if (verbose) {
          console.log(`Migrating ${student.rollNumber}: ${student.name}...`);
        }

        // Copy legacy descriptor to new array format
        student.faceDescriptors = [student.faceDescriptor];
        student.descriptorCount = 1;
        
        await student.save();
        successCount++;

        if (verbose) {
          console.log(`  ✅ Success`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error migrating ${student.rollNumber}: ${error.message}`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("Migration Complete");
    console.log("=".repeat(60));
    console.log(`  Total processed: ${studentsToMigrate.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${errorCount}`);
    console.log("");

    await mongoose.connection.close();
    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error) {
    console.error("\nMigration failed:", error.message);
    console.error(error.stack);
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(1);
  }
}

// Run migration
migrate();
