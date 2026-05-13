/**
 * Migration: backfill `faceDescriptors` from legacy `faceDescriptor`.
 *
 * Finds students with a legacy descriptor and a missing or empty
 * `faceDescriptors` array, then copies the legacy vector into the new format.
 *
 * Usage:
 *   cd Backend
 *   node scripts/migrate-descriptors.js
 *
 * Options:
 *   --dry-run  Print changes without writing
 *   --verbose  Print per-student details
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Parse CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");

// Database connection
const connectDB = require("../db");

// Inline model to avoid circular imports
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
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Connected successfully!\n");

    // Reuse model if already registered
    let Student;
    try {
      Student = mongoose.model("Student");
    } catch {
      Student = mongoose.model("Student", studentSchema);
    }

    // Legacy descriptor present, new array missing or empty
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

    // Preview list
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

    // Apply migration
    let successCount = 0;
    let errorCount = 0;

    for (const student of studentsToMigrate) {
      try {
        if (verbose) {
          console.log(`Migrating ${student.rollNumber}: ${student.name}...`);
        }

        // Copy legacy vector into the new array format
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

    // Final summary
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
    } catch { }
    process.exit(1);
  }
}

// Execute migration
migrate();
