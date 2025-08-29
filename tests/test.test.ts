// Position Mapping Usage Example - Shows line-by-line plagiarism detection
import { PascalPlagiarismDetector } from '../core/fingerprinter/pascalFingerprinter.ts';
import { PascalTokenizer } from '../core/tokenizer/tokenizer.ts';
import { TokenizedFile } from '../core/file/tokenizedFile.ts';
import {Region} from '../core/util/region.ts'

// Example Pascal programs with original code
const testPrograms = {
  student1: {
    code: ` 
    program StudentManager;

type
  Student = record
    name: string;
    grades: array[1..3] of integer;
    average: real;
  end;

var
  students: array[1..3] of Student;
  i, j, total: integer;

begin
  writeln('Enter information for 3 students.');
  for i := 1 to 3 do
  begin
    writeln('Student ', i, ':');
    write('Name: ');
    readln(students[i].name);
    total := 0;

    for j := 1 to 3 do
    begin
      write('Grade ', j, ': ');
      readln(students[i].grades[j]);
      total := total + students[i].grades[j];
    end;

    students[i].average := total / 3.0;
  end;

  writeln;
  writeln('Results:');
  for i := 1 to 3 do
  begin
    writeln('Student: ', students[i].name);
    writeln('Average: ', students[i].average:0:2);
    if students[i].average >= 10.0 then
      writeln('Status: Pass')
    else
      writeln('Status: Fail');
    writeln('---');
  end;
end.
.`,
    name: 'student1.pas'
  },
  
  student2: {
    code: `program ManageStudents;

type
  TStudent = record
    fullName: string;
    marks: array[1..3] of integer;
    avg: real;
  end;

var
  sList: array[1..3] of TStudent;
  idx, k, sumMarks: integer;

begin
  writeln('Input student data:');
  for idx := 1 to 3 do
  begin
    writeln('Details for student ', idx);
    write('Full Name: ');
    readln(sList[idx].fullName);

    sumMarks := 0;
    // Read 3 marks
    for k := 1 to 3 do
    begin
      write('Enter mark ', k, ': ');
      readln(sList[idx].marks[k]);
      sumMarks := sumMarks + sList[idx].marks[k];
    end;

    // Compute average
    sList[idx].avg := sumMarks / 3.0;
  end;

  // Output section
  writeln;
  writeln('Summary of Results:');
  for idx := 1 to 3 do
  begin
    writeln('Name: ', sList[idx].fullName);
    writeln('Avg Mark: ', sList[idx].avg:0:2);

    if sList[idx].avg < 10.0 then
      writeln('Result: Fail')
    else
      writeln('Result: Pass');

    writeln;
  end;
end.
`,
    name: 'student2.pas'
  },
  
  student3: {
    code: `program StudentPerformanceTracker;

type
  StudentRec = record
    id: integer;
    fullName: string;
    math, science, literature: integer;
    average: real;
  end;

var
  recs: array[1..3] of StudentRec;
  i: integer;

function ComputeAverage(a, b, c: integer): real;
begin
  ComputeAverage := (a + b + c) / 3.0;
end;

begin
  writeln('=== Student Performance Tracker ===');
  for i := 1 to 3 do
  begin
    writeln('Record for student ', i);
    write('Student ID: ');
    readln(recs[i].id);
    write('Full Name: ');
    readln(recs[i].fullName);
    write('Math grade: ');
    readln(recs[i].math);
    write('Science grade: ');
    readln(recs[i].science);
    write('Literature grade: ');
    readln(recs[i].literature);

    recs[i].average := ComputeAverage(recs[i].math, recs[i].science, recs[i].literature);
  end;

  writeln;
  writeln('--- Final Report ---');
  for i := 1 to 3 do
  begin
    writeln('ID: ', recs[i].id);
    writeln('Name: ', recs[i].fullName);
    writeln('Average Score: ', recs[i].average:0:2);
    if recs[i].average >= 10.0 then
      writeln('=> Status: Pass')
    else
      writeln('=> Status: Needs Improvement');
    writeln('----------------------');
  end;
end.
`,
    name: 'student3.pas'
  }
};

async function demonstratePositionMapping() {
  console.log('🎯 Pascal Plagiarism Detection with Position Mapping\n');

  const detector = new PascalPlagiarismDetector(6, 12); // Smaller k-gram for more detailed detection
  const tokenizer = new PascalTokenizer();

  // Tokenize all programs using the new tokenizer interface
  const files: Array<{
    name: string;
    tokenizedFile: TokenizedFile;
    originalCode: string;
  }> = Object.values(testPrograms).map(program => ({
    name: program.name,
    tokenizedFile: tokenizer.tokenizeFile(program.name, program.code),
    originalCode: program.code
  }));

  console.log('📁 Files to analyze:');
  files.forEach(file => {
    const lines = file.originalCode.split('\n').length;
    const tokenCount = file.tokenizedFile.tokens.length;
    console.log(`   ${file.name}: ${tokenCount} tokens, ${lines} lines`);
  });

  // Convert to the format expected by the detector
  const detectorFiles = files.map(file => ({
    name: file.name,
    normalizedTokens: file.tokenizedFile.tokens,
    originalCode: file.originalCode
  }));

  // Run basic plagiarism detection
  const result = detector.detectPlagiarism(detectorFiles);
  
  console.log('\n📊 Detection Results:');
  console.log(`   Threshold: ${(result.threshold * 100).toFixed(1)}%`);
  console.log(`   Plagiarism detected: ${result.plagiarismDetected ? 'YES' : 'NO'}`);
  console.log(`   Suspicious pairs: ${result.suspiciousPairs.length}`);

  // Show detailed analysis for each suspicious pair
  if (result.suspiciousPairs.length > 0) {
    console.log('\n🔍 Detailed Region Analysis:\n');
    
    for (const pair of result.suspiciousPairs) {
      console.log(`📋 Analyzing: ${pair.file1} ↔ ${pair.file2}`);
      console.log(`   Similarity: ${(pair.similarity * 100).toFixed(1)}%`);
      
      // Debug: Let's see what properties are available on the pair object
      console.log(`   Available properties: ${Object.keys(pair).join(', ')}`);
      
      // Check if sharedRegions exists, if not we'll get it from the detailed report
      if (pair.sharedRegions) {
        console.log(`   Shared regions: ${pair.sharedRegions.length}`);
      } else {
        console.log(`   Shared regions: Not available in pair object, will get from detailed report`);
      }

      // Get the original code for both files
      const file1Data = files.find(f => f.name === pair.file1);
      const file2Data = files.find(f => f.name === pair.file2);

      if (file1Data && file2Data) {
        // Get detailed plagiarism report with line mappings
        const report = detector.getDetailedPlagiarismReport(
          pair.file1, file1Data.tokenizedFile.tokens, file1Data.originalCode,
          pair.file2, file2Data.tokenizedFile.tokens, file2Data.originalCode
        );

        if (report) {
          console.log(`   📍 Total shared lines: ${report.totalSharedLines}`);
          
          // Show each plagiarized region
          report.mappedRegions.forEach((region, index) => {
            console.log(`\n   🚨 Plagiarized Region ${index + 1}:`);
            console.log(`      ${pair.file1} lines ${region.file1Lines.start}-${region.file1Lines.end}`);
            console.log(`      ${pair.file2} lines ${region.file2Lines.start}-${region.file2Lines.end}`);
            console.log(`      Confidence: ${(region.confidence * 100).toFixed(1)}%`);
            console.log(`      Shared tokens: ${region.sharedTokens.length}`);

            // Show the actual plagiarized code
            console.log(`\n      📝 Code from ${pair.file1}:`);
            const file1Lines = region.file1CodeSnippet.split('\n');
            file1Lines.forEach((line, i) => {
              const lineNum = region.file1Lines.start + i;
              console.log(`      ${lineNum.toString().padStart(3)}: ${line}`);
            });

            console.log(`\n      📝 Code from ${pair.file2}:`);
            const file2Lines = region.file2CodeSnippet.split('\n');
            file2Lines.forEach((line, i) => {
              const lineNum = region.file2Lines.start + i;
              console.log(`      ${lineNum.toString().padStart(3)}: ${line}`);
            });

            // Show token-level analysis
            console.log(`\n      🔤 Token pattern: "${region.sharedTokens.slice(0, 15).join(' ')}${region.sharedTokens.length > 15 ? '...' : ''}"`);
          });
        }

        // Visual code region analysis (only if we have shared regions from the pair)
        if (pair.sharedRegions && pair.sharedRegions.length > 0) {
          console.log('\n      🎨 Visual Analysis:');
          const analysis = detector.analyzeCodeRegions(
            file1Data.originalCode,
            file1Data.tokenizedFile.tokens,
            pair.sharedRegions
          );
          console.log(analysis);
        } else if (report && report.mappedRegions && report.mappedRegions.length > 0) {
          // Alternative: use regions from the detailed report
          console.log('\n      🎨 Visual Analysis (from detailed report):');
          const dummyRegion = new Region(0, 0, 0, 0);
          const reportRegions = report.mappedRegions.map(region => ({
            file1Range: region.file1TokenRange || { start: 0, end: 0 },
            file2Range: region.file2TokenRange || { start: 0, end: 0 },
            file1Lines: region.file1Lines || { start: 0, end: 0 },
            file2Lines: region.file2Lines || { start: 0, end: 0 },
            sharedTokens: region.sharedTokens || [],
            confidence: region.confidence || 0,
            region1: dummyRegion,
            region2: dummyRegion
          }));
          const analysis = detector.analyzeCodeRegions(
            file1Data.originalCode,
            file1Data.tokenizedFile.tokens,
            reportRegions
          );
          console.log(analysis);
        }
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
  }
}

async function compareSpecificFiles() {
  console.log('🔬 Specific File Comparison Example\n');
  
  const detector = new PascalPlagiarismDetector(8, 15);
  const tokenizer = new PascalTokenizer();

  const file1 = testPrograms.student1;
  const file2 = testPrograms.student2;

  // Use the new tokenizer interface
  const tokenizedFile1 = tokenizer.tokenizeFile(file1.name, file1.code);
  const tokenizedFile2 = tokenizer.tokenizeFile(file2.name, file2.code);

  const tokens1 = tokenizedFile1.tokens;
  const tokens2 = tokenizedFile2.tokens;

  // Direct comparison with region mapping
  const comparison = detector.compareTwoFiles(tokens1, tokens2);
  
  console.log(`📊 Direct Comparison: ${file1.name} vs ${file2.name}`);
  console.log(`   Available comparison properties: ${Object.keys(comparison).join(', ')}`);
  console.log(`   Jaccard similarity: ${(comparison.similarity * 100).toFixed(1)}%`);
  
  // Handle different possible property names - check what actually exists
  if (comparison.sharedFingerprints !== undefined) {
    console.log(`   Shared fingerprints: ${comparison.sharedFingerprints}`);
  }
  
  if (comparison.sharedRegions !== undefined) {
    console.log(`   Shared regions found: ${comparison.sharedRegions.length}`);
  } else {
    console.log(`   Shared regions: Not available in comparison object`);
  }

  // Get detailed report
  const report = detector.getDetailedPlagiarismReport(
    file1.name, tokens1, file1.code,
    file2.name, tokens2, file2.code
  );

  if (report) {
    console.log('\n📋 Detailed Plagiarism Report:');
    console.log(`   Files: ${report.file1} ↔ ${report.file2}`);
    console.log(`   Similarity: ${(report.similarity * 100).toFixed(1)}%`);
    console.log(`   Total shared lines: ${report.totalSharedLines}`);
    console.log(`   Plagiarized regions: ${report.mappedRegions.length}`);

    // Show line-by-line breakdown
    console.log('\n📍 Line-by-Line Breakdown:');
    report.mappedRegions.forEach((region, i) => {
      console.log(`\n   🚨 Region ${i + 1}:`);
      console.log(`      ${report.file1} lines ${region.file1Lines.start}-${region.file1Lines.end}`);
      console.log(`      ${report.file2} lines ${region.file2Lines.start}-${region.file2Lines.end}`);
      console.log(`      Confidence: ${(region.confidence * 100).toFixed(1)}%`);
      console.log(`      Shared tokens: ${region.sharedTokens.length}`);

      console.log(`\n      📝 Code from ${report.file1}:`);
      const file1Lines = region.file1CodeSnippet.split('\n');
      file1Lines.forEach((line, idx) => {
        const lineNum = region.file1Lines.start + idx;
        console.log(`      ${lineNum.toString().padStart(3)}: ${line}`);
      });

      console.log(`\n      📝 Code from ${report.file2}:`);
      const file2Lines = region.file2CodeSnippet.split('\n');
      file2Lines.forEach((line, idx) => {
        const lineNum = region.file2Lines.start + idx;
        console.log(`      ${lineNum.toString().padStart(3)}: ${line}`);
      });

      console.log(`\n      🔤 Token pattern: "${region.sharedTokens.slice(0, 15).join(' ')}${region.sharedTokens.length > 15 ? '...' : ''}"`);
    });

    // Optional: Visual Analysis (only if we have regions from report)
    if (report && report.mappedRegions && report.mappedRegions.length > 0) {
      console.log('\n   🎨 Visual Region Analysis:');
      const dummyRegion = new Region(0, 0, 0, 0);
      const regionData = report.mappedRegions.map(region => ({
        file1Range: region.file1TokenRange || { start: 0, end: 0 },
        file2Range: region.file2TokenRange || { start: 0, end: 0 },
        file1Lines: region.file1Lines || { start: 0, end: 0 },
        file2Lines: region.file2Lines || { start: 0, end: 0 },
        sharedTokens: region.sharedTokens || [],
        confidence: region.confidence || 0,
        region1: dummyRegion,
        region2: dummyRegion,
      }));
      const visual = detector.analyzeCodeRegions(
        file1.code,
        tokens1,
        regionData
      );
      console.log(visual);
    } else if (comparison.sharedRegions && comparison.sharedRegions.length > 0) {
      console.log('\n   🎨 Visual Region Analysis (from comparison):');
      const visual = detector.analyzeCodeRegions(
        file1.code,
        tokens1,
        comparison.sharedRegions
      );
      console.log(visual);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the demonstrations
(async () => {
  await demonstratePositionMapping();
  await compareSpecificFiles();
})();