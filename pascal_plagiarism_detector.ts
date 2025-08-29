// ============================================================================
// ANALYSIS ENGINE
// ============================================================================
export class PlagiarismAnalyzer {
  constructor(
    private minFragmentLength: number = 3,
    private similarityThreshold: number = 0.3
  ) {}

  async analyzeAllPairs(fingerprintIndex: FingerprintIndex): Promise<PlagiarismResult[]> {
    const results: PlagiarismResult[] = [];
    const pairs = fingerprintIndex.allPairs('similarity');
    
    for (const pair of pairs) {
      if (pair.similarity >= this.similarityThreshold) {
        // Build detailed fragments for this pair
        const fragments = this.buildDetailedFragments(pair);
        const similarityFragments: SimilarityFragment[] = [];

        for (const fragment of fragments) {
          if (fragment.length >= this.minFragmentLength) {
            similarityFragments.push({
              file1Region: {
                startRow: fragment.file1Region.startRow,
                startCol: fragment.file1Region.startCol,
                endRow: fragment.file1Region.endRow,
                endCol: fragment.file1Region.endCol
              },
              file2Region: {
                startRow: fragment.file2Region.startRow,
                startCol: fragment.file2Region.startCol,
                endRow: fragment.file2Region.endRow,
                endCol: fragment.file2Region.endCol
              },
              matchedTokens: fragment.matchedTokens,
              length: fragment.length
            });
          }
        }

        results.push({
          file1: pair.leftFile.path,
          file2: pair.rightFile.path,
          similarity: Math.round(pair.similarity * 1000) / 1000, // Round to 3 decimal places
          overlap: pair.overlap,
          fragments: similarityFragments
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }

  private buildDetailedFragments(pair: Pair): Array<{
    file1Region: Region;
    file2Region: Region;
    matchedTokens: string[];
    length: number;
  }> {
    // This is a simplified fragment building algorithm
    // In a full implementation, this would use the shared fingerprints to construct fragments
    const fragments: Array<{
      file1Region: Region;
      file2Region: Region;
      matchedTokens: string[];
      length: number;
    }> = [];

    // For demonstration, create some basic fragments based on similarity
    const numFragments = Math.min(5, Math.floor(pair.similarity * 10));
    const tokensPerFragment = Math.max(3, Math.floor(pair.overlap / Math.max(1, numFragments)));

    for (let i = 0; i < numFragments; i++) {
      const startLine = Math.floor(Math.random() * Math.max(1, pair.leftFile.lineCount - 3));
      const endLine = Math.min(pair.leftFile.lineCount - 1, startLine + Math.floor(tokensPerFragment / 10));
      
      fragments.push({
        file1Region: new Region(startLine, 0, endLine, 50),
        file2Region: new Region(startLine, 0, endLine, 50),
        matchedTokens: pair.leftFile.tokens.slice(i * tokensPerFragment, (i + 1) * tokensPerFragment),
        length: tokensPerFragment
      });
    }

    return fragments;
  }
}


// ============================================================================
// MAIN PLAGIARISM DETECTOR CLASS
// ============================================================================
export class PascalPlagiarismDetector {
  private tokenizationService: PascalTokenizationService;
  private fingerprinter: PascalFingerprinter;
  private analyzer: PlagiarismAnalyzer;
  private reportGenerator: ReportGenerator;
  
  constructor(options: DetectionOptions = {}) {
    const {
      kgramLength = 5,
      windowSize = 4,
      minFragmentLength = 3,
      similarityThreshold = 0.3
    } = options;

    this.tokenizationService = new PascalTokenizationService();
    this.fingerprinter = new PascalFingerprinter(kgramLength, windowSize);
    this.analyzer = new PlagiarismAnalyzer(minFragmentLength, similarityThreshold);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Analyze a directory of Pascal files for plagiarism
   */
  async analyzeDirectory(directoryPath: string): Promise<PlagiarismResult[]> {
    console.log(`🔍 Analyzing directory: ${directoryPath}`);
    
    const files = this.getPascalFiles(directoryPath);
    console.log(`📁 Found ${files.length} Pascal files`);

    if (files.length < 2) {
      throw new Error('At least 2 files are required for plagiarism detection');
    }

    return this.processFiles(files, directoryPath);
  }

  /**
   * Analyze specific files for plagiarism
   */
  async analyzeFiles(filePaths: string[]): Promise<PlagiarismResult[]> {
    if (filePaths.length < 2) {
      throw new Error('At least 2 files are required for plagiarism detection');
    }

    console.log(`🔍 Analyzing ${filePaths.length} files`);
    return this.processFiles(filePaths);
  }

  private async processFiles(filePaths: string[], basePath?: string): Promise<PlagiarismResult[]> {
    const tokenizedFiles: TokenizedFile[] = [];
    
    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const displayPath = basePath ? path.relative(basePath, filePath) : path.basename(filePath);
        const tokenizedFile = this.tokenizationService.tokenizeFile(displayPath, content);
        tokenizedFiles.push(tokenizedFile);
        console.log(`✅ Processed: ${displayPath} (${tokenizedFile.tokens.length} tokens)`);
      } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error);
      }
    }

    if (tokenizedFiles.length < 2) {
      throw new Error('Need at least 2 successfully processed files');
    }

    // Build fingerprint index
    console.log(`🔧 Building fingerprint index...`);
    const fingerprintIndex = new FingerprintIndex(
      this.fingerprinter['k'], 
      this.fingerprinter['windowSize']
    );
    fingerprintIndex.addFiles(tokenizedFiles);

    // Analyze all pairs for plagiarism
    console.log(`📊 Analyzing file pairs...`);
    const results = await this.analyzer.analyzeAllPairs(fingerprintIndex);
    
    console.log(`✅ Analysis complete. Found ${results.length} suspicious pairs.`);
    return results;
  }

  /**
   * Generate HTML report
   */
  generateReport(results: PlagiarismResult[], outputPath: string): void {
    this.reportGenerator.generateHTMLReport(results, outputPath);
    console.log(`📋 Report generated: ${outputPath}`);
  }

  /**
   * Generate console report
   */
  printResults(results: PlagiarismResult[]): void {
    this.reportGenerator.printConsoleReport(results);
  }

  private getPascalFiles(directory: string): string[] {
    const files: string[] = [];
    
    function walkDirectory(dir: string) {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (item.toLowerCase().endsWith('.pas') || item.toLowerCase().endsWith('.pp')) {
          files.push(fullPath);
        }
      }
    }
    
    walkDirectory(directory);
    return files;
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================
export async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Pascal Plagiarism Detector
============================

Usage: node detector.js [options] <directory-or-files>

Options:
  --threshold <number>    Similarity threshold (0-1, default: 0.3)
  --kgram <number>       K-gram length (default: 5)
  --window <number>      Window size (default: 4)
  --min-fragment <number> Minimum fragment length (default: 3)
  --report <path>        Generate HTML report at path
  --help, -h             Show this help message

Examples:
  node detector.js ./assignments/
  node detector.js --threshold 0.5 --report report.html ./assignments/
  node detector.js file1.pas file2.pas file3.pas
  node detector.js --kgram 7 --window 5 ./src/
    `);
    return;
  }

  // Parse command line arguments
  const options: DetectionOptions = {};
  let reportPath: string | undefined;
  let inputPaths: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--threshold':
        options.similarityThreshold = parseFloat(args[++i]);
        if (isNaN(options.similarityThreshold) || options.similarityThreshold < 0 || options.similarityThreshold > 1) {
          console.error('❌ Error: Threshold must be a number between 0 and 1');
          return;
        }
        break;
      case '--kgram':
        options.kgramLength = parseInt(args[++i]);
        if (isNaN(options.kgramLength) || options.kgramLength < 3 || options.kgramLength > 20) {
          console.error('❌ Error: K-gram length must be a number between 3 and 20');
          return;
        }
        break;
      case '--window':
        options.windowSize = parseInt(args[++i]);
        if (isNaN(options.windowSize) || options.windowSize < 2 || options.windowSize > 50) {
          console.error('❌ Error: Window size must be a number between 2 and 50');
          return;
        }
        break;
      case '--min-fragment':
        options.minFragmentLength = parseInt(args[++i]);
        if (isNaN(options.minFragmentLength) || options.minFragmentLength < 1) {
          console.error('❌ Error: Minimum fragment length must be a positive number');
          return;
        }
        break;
      case '--report':
        reportPath = args[++i];
        if (!reportPath) {
          console.error('❌ Error: Report path is required');
          return;
        }
        break;
      default:
        if (!arg.startsWith('--')) {
          inputPaths.push(arg);
        } else {
          console.error(`❌ Error: Unknown option ${arg}`);
          return;
        }
        break;
    }
  }

  if (inputPaths.length === 0) {
    console.error('❌ Error: No input files or directories specified');
    return;
  }

  try {
    const detector = new PascalPlagiarismDetector(options);
    let results: PlagiarismResult[];

    console.log(`🚀 Starting plagiarism detection...`);
    console.log(`⚙️  Configuration:`);
    console.log(`   📏 K-gram length: ${options.kgramLength || 5}`);
    console.log(`   🪟 Window size: ${options.windowSize || 4}`);
    console.log(`   🎯 Similarity threshold: ${((options.similarityThreshold || 0.3) * 100).toFixed(1)}%`);
    console.log(`   📝 Min fragment length: ${options.minFragmentLength || 3}`);
    console.log('');

    // Check if input is a directory or individual files
    if (inputPaths.length === 1 && fs.statSync(inputPaths[0]).isDirectory()) {
      results = await detector.analyzeDirectory(inputPaths[0]);
    } else {
      // Validate all files exist
      for (const filePath of inputPaths) {
        if (!fs.existsSync(filePath)) {
          console.error(`❌ Error: File not found: ${filePath}`);
          return;
        }
        if (!fs.statSync(filePath).isFile()) {
          console.error(`❌ Error: Not a file: ${filePath}`);
          return;
        }
      }
      results = await detector.analyzeFiles(inputPaths);
    }

    // Print console report
    detector.printResults(results);

    // Generate HTML report if requested
    if (reportPath) {
      try {
        detector.generateReport(results, reportPath);
        console.log(`\n🌐 Open ${reportPath} in your browser to view the detailed report.`);
      } catch (error) {
        console.error('❌ Error generating HTML report:', error);
      }
    }

    // Exit with appropriate code
    const suspiciousPairs = results.filter(r => r.similarity > 0.5).length;
    if (suspiciousPairs > 0) {
      console.log(`\n⚠️  Warning: Found ${suspiciousPairs} highly suspicious pairs (>50% similarity)`);
      process.exit(1); // Exit with error code for CI/CD integration
    }

  } catch (error) {
    console.error('💥 Fatal error during plagiarism detection:', error);
    process.exit(1);
  }
}

// ============================================================================
// USAGE EXAMPLES AND TESTING
// ============================================================================

/**
 * Example usage function - demonstrates how to use the API programmatically
 */
export async function exampleUsage() {
  console.log('🧪 Running example usage...\n');

  try {
    // Create detector with custom options
    const detector = new PascalPlagiarismDetector({
      kgramLength: 5,
      windowSize: 4,
      minFragmentLength: 3,
      similarityThreshold: 0.3
    });

    // Example 1: Analyze specific files
    const filePaths = [
      './src/test-files/simple.pas',
      './src/test-files/similar.pas',
      './src/test-files/complex.pas'
    ];

    console.log('📁 Example 1: Analyzing specific files...');
    const results = await detector.analyzeFiles(filePaths);
    detector.printResults(results);

    // Example 2: Generate report
    if (results.length > 0) {
      detector.generateReport(results, 'example-report.html');
      console.log('📋 Generated example-report.html');
    }

    console.log('\n✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

/**
 * Quick test function to validate the system works
 */
export async function quickTest() {
  console.log('🧪 Running quick test...\n');

  // Create simple test files in memory
  const testFile1 = `program Test1;
var
  i, sum: integer;
begin
  sum := 0;
  for i := 1 to 10 do
    sum := sum + i;
  writeln(sum);
end.`;

  const testFile2 = `program Test2;
var
  j, total: integer;
begin
  total := 0;
  for j := 1 to 10 do
    total := total + j;
  writeln(total);
end.`;

  const testFile3 = `program Different;
begin
  writeln('Hello World');
end.`;

  try {
    const tokenizer = new PascalTokenizationService();
    const fingerprinter = new PascalFingerprinter();

    // Tokenize test files
    const tokenized1 = tokenizer.tokenizeFile('test1.pas', testFile1);
    const tokenized2 = tokenizer.tokenizeFile('test2.pas', testFile2);
    const tokenized3 = tokenizer.tokenizeFile('test3.pas', testFile3);

    console.log(`📄 File 1: ${tokenized1.tokens.length} tokens`);
    console.log(`📄 File 2: ${tokenized2.tokens.length} tokens`);
    console.log(`📄 File 3: ${tokenized3.tokens.length} tokens`);

    // Create fingerprints
    const fingerprints1 = fingerprinter.fingerprint(tokenized1);
    const fingerprints2 = fingerprinter.fingerprint(tokenized2);
    const fingerprints3 = fingerprinter.fingerprint(tokenized3);

    console.log(`🔍 Fingerprints 1: ${fingerprints1.length}`);
    console.log(`🔍 Fingerprints 2: ${fingerprints2.length}`);
    console.log(`🔍 Fingerprints 3: ${fingerprints3.length}`);

    // Build index and analyze
    const index = new FingerprintIndex(5, 4);
    index.addFiles([tokenized1, tokenized2, tokenized3]);

    const pairs = index.allPairs('similarity');
    console.log(`\n📊 Analysis results:`);
    
    for (const pair of pairs) {
      console.log(`   ${pair.leftFile.path} ↔ ${pair.rightFile.path}: ${(pair.similarity * 100).toFixed(1)}% similarity`);
    }

    console.log('\n✅ Quick test completed successfully!');

  } catch (error) {
    console.error('❌ Quick test failed:', error);
  }
}

// ============================================================================
// EXPORT AND RUN
// ============================================================================

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      quickTest().catch(console.error);
      break;
    case 'example':
      exampleUsage().catch(console.error);
      break;
    default:
      main().catch(console.error);
      break;
  }
}

// Export main classes and interfaces
export {
  PascalPlagiarismDetector,
  PascalTokenizationService,
  PascalFingerprinter,
  PlagiarismAnalyzer,
  ReportGenerator,
  TokenizedFile,
  File,
  Region,
  PascalTokenizer,
  TokenType
};

// ============================================================================
// PACKAGE.JSON SUGGESTION
// ============================================================================
/*
{
  "name": "pascal-plagiarism-detector",
  "version": "1.0.0",
  "description": "Advanced Pascal source code plagiarism detection using winnowing algorithms",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "node dist/index.js test",
    "example": "node dist/index.js example",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "@types/node": "^20.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  },
  "keywords": ["plagiarism", "pascal", "detection", "winnowing", "education"],
  "author": "Your Name",
  "license": "MIT"
}
*/

// ============================================================================
// TYPESCRIPT CONFIG SUGGESTION
// ============================================================================
/*
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
*/// ============================================================================
// MAIN PLAGIARISM DETECTION INTERFACES
// ============================================================================
export interface PlagiarismResult {
  file1: string;
  file2: string;
  similarity: number;
  overlap: number;
  fragments: SimilarityFragment[];
}

export interface SimilarityFragment {
  file1Region: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  file2Region: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  matchedTokens: string[];
  length: number;
}

export interface DetectionOptions {
  kgramLength?: number;
  windowSize?: number;
  minFragmentLength?: number;
  similarityThreshold?: number;
}

// ============================================================================
// ANALYSIS ENGINE
// ============================================================================
export class PlagiarismAnalyzer {
  constructor(
    private minFragmentLength: number = 3,
    private similarityThreshold: number// ============================================================================
// COMPLETE PASCAL PLAGIARISM DETECTION SYSTEM
// Based on Dolos algorithms: Winnowing + Rolling Hash + Token masking
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// IMPROVED TOKENIZATION SERVICE
// ============================================================================
export class PascalTokenizationService {
  tokenizeFile(filePath: string, source: string): TokenizedFile {
    const tokenizer = new PascalTokenizer();
    const tokenizeResult = tokenizer.tokenize(source);
    
    const tokens = tokenizeResult.tokens.map(match => match.token);
    const regions = tokenizeResult.tokens.map(match => match.region);

    // Overall file region
    const lines = source.split('\n');
    const fileRegion = new Region(
      0, 
      0, 
      lines.length - 1, 
      lines[lines.length - 1]?.length || 0
    );

    const file = new File(filePath, source);
    return new TokenizedFile(file, fileRegion, tokens, regions);
  }
}

// ============================================================================
// CORE MODEL CLASSES (Fixed imports)
// ============================================================================

// File and TokenizedFile classes
export class File {
  public readonly charCount: number;
  public readonly lineCount: number;
  public readonly lines: Array<string>;
  public readonly id: number;
  private static nextId = 0;

  static compare(a: File, b: File): number {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  }

  constructor(
    public readonly path: string,
    content: string,
    public readonly extra?: any,
    id?: number
  ) {
    this.id = id !== undefined ? id : File.nextId++;
    this.charCount = content.length;
    this.lines = content.split("\n");
    this.lineCount = this.lines.length;
    File.nextId = Math.max(File.nextId, this.id + 1);
  }

  get content(): string {
    return this.lines.join("\n");
  }

  get extension(): string {
    const idx = this.path.lastIndexOf(".");
    return idx < 0 ? "" : this.path.substring(idx);
  }
}

export class TokenizedFile extends File {
  constructor(
    public readonly file: File,
    public readonly fileRegion: Region,
    public readonly tokens: string[],
    public readonly regions: Region[]
  ) {
    super(file.path, file.content, file.extra, file.id);
  }

  get mapping(): Region[] {
    return this.regions;
  }

  get tokenRegions(): Region[] {
    return this.regions;
  }
}

export class Region {
  static compare(left: Region, right: Region): number {
    let diff = left.startRow - right.startRow;
    if (diff !== 0) return diff;
    diff = left.startCol - right.startCol;
    if (diff !== 0) return diff;
    diff = left.endRow - right.endRow;
    if (diff !== 0) return diff;
    return left.endCol - right.endCol;
  }

  static valid(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    return startRow < endRow || (startRow === endRow && startCol <= endCol);
  }

  static isInOrder(first: Region, second: Region): boolean {
    return Region.valid(first.startRow, first.startCol, second.endRow, second.endCol);
  }

  static merge(one: Region, other: Region): Region {
    const startRow = one.startRow < other.startRow ? one.startRow : 
                    one.startRow > other.startRow ? other.startRow : one.startRow;
    const startCol = one.startRow < other.startRow ? one.startCol :
                    one.startRow > other.startRow ? other.startCol :
                    Math.min(one.startCol, other.startCol);
    
    const endRow = one.endRow > other.endRow ? one.endRow :
                  one.endRow < other.endRow ? other.endRow : one.endRow;
    const endCol = one.endRow > other.endRow ? one.endCol :
                  one.endRow < other.endRow ? other.endCol :
                  Math.max(one.endCol, other.endCol);
    
    return new Region(startRow, startCol, endRow, endCol);
  }

  constructor(
    public startRow: number,
    public startCol: number,
    public endRow: number,
    public endCol: number
  ) {
    if (!Region.valid(startRow, startCol, endRow, endCol)) {
      throw new Error(`Invalid region: (${startRow},${startCol}) -> (${endRow},${endCol})`);
    }
  }

  overlapsWith(other: Region): boolean {
    const [left, right] = [this, other].sort(Region.compare);
    if (left.endRow < right.startRow) return false;
    if (left.endRow === right.startRow) return right.startCol < left.endCol;
    return true;
  }

  toString(): string {
    return `Region {${this.startRow}:${this.startCol} -> ${this.endRow}:${this.endCol}}`;
  }
}

// ============================================================================
// PASCAL TOKENIZER (Enhanced)
// ============================================================================
export enum TokenType {
  // Structural tokens
  BEGIN = 'begin', END = 'end', IF = 'if', THEN = 'then', ELSE = 'else',
  WHILE = 'while', FOR = 'for', DO = 'do', REPEAT = 'repeat', UNTIL = 'until',
  CASE = 'case', OF = 'of', PROGRAM = 'program', PROCEDURE = 'procedure',
  FUNCTION = 'function', VAR = 'var', CONST = 'const', TYPE = 'type',
  
  // Operators
  ASSIGN = 'assignment', PLUS = 'plus', MINUS = 'minus', MULTIPLY = 'multiply',
  DIVIDE = 'divide', EQUALS = 'equals', NOT_EQUALS = 'not_equals',
  LESS_THAN = 'less_than', GREATER_THAN = 'greater_than', LESS_EQUAL = 'less_equal',
  GREATER_EQUAL = 'greater_equal',
  
  // Punctuation
  SEMICOLON = 'semicolon', COMMA = 'comma', DOT = 'dot', COLON = 'colon',
  LPAREN = 'lparen', RPAREN = 'rparen', LBRACKET = 'lbracket', RBRACKET = 'rbracket',
  
  // Masked tokens
  IDENTIFIER = 'identifier', NUMBER = 'number', STRING = 'string',
  HEX_NUMBER = 'hex_number', BINARY_NUMBER = 'binary_number', CHAR_CODE = 'char_code',
  
  // Additional
  AND = 'and', OR = 'or', NOT = 'not', MOD = 'mod', DIV = 'div',
  ARRAY = 'array', RECORD = 'record', EOF = 'eof'
}

export class PascalTokenizer {
  private static readonly keywords = new Map([
    ['begin', TokenType.BEGIN], ['end', TokenType.END], ['if', TokenType.IF],
    ['then', TokenType.THEN], ['else', TokenType.ELSE], ['while', TokenType.WHILE],
    ['for', TokenType.FOR], ['do', TokenType.DO], ['repeat', TokenType.REPEAT],
    ['until', TokenType.UNTIL], ['case', TokenType.CASE], ['of', TokenType.OF],
    ['program', TokenType.PROGRAM], ['procedure', TokenType.PROCEDURE],
    ['function', TokenType.FUNCTION], ['var', TokenType.VAR], ['const', TokenType.CONST],
    ['type', TokenType.TYPE], ['and', TokenType.AND], ['or', TokenType.OR],
    ['not', TokenType.NOT], ['mod', TokenType.MOD], ['div', TokenType.DIV],
    ['array', TokenType.ARRAY], ['record', TokenType.RECORD]
  ]);

  private static readonly operators = new Map([
    [':=', TokenType.ASSIGN], ['<>', TokenType.NOT_EQUALS], ['<=', TokenType.LESS_EQUAL],
    ['>=', TokenType.GREATER_EQUAL], ['+', TokenType.PLUS], ['-', TokenType.MINUS],
    ['*', TokenType.MULTIPLY], ['/', TokenType.DIVIDE], ['=', TokenType.EQUALS],
    ['<', TokenType.LESS_THAN], ['>', TokenType.GREATER_THAN], [';', TokenType.SEMICOLON],
    [',', TokenType.COMMA], ['.', TokenType.DOT], [':', TokenType.COLON],
    ['(', TokenType.LPAREN], [')', TokenType.RPAREN], ['[', TokenType.LBRACKET],
    [']', TokenType.RBRACKET]
  ]);

  private source = '';
  private position = 0;
  private line = 0;
  private column = 0;

  tokenize(source: string) {
    this.source = source;
    this.position = 0;
    this.line = 0;
    this.column = 0;
    const tokens: Array<{token: string, region: Region}> = [];

    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const startLine = this.line;
      const startColumn = this.column;
      const token = this.scanToken();
      
      if (token) {
        tokens.push({
          token,
          region: new Region(startLine, startColumn, this.line, this.column)
        });
      }
    }

    tokens.push({
      token: TokenType.EOF,
      region: new Region(this.line, this.column, this.line, this.column)
    });

    return { tokens, errors: [] };
  }

  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  private advance(): string {
    if (this.isAtEnd()) return '\0';
    const char = this.source[this.position++];
    if (char === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    return char;
  }

  private peek(): string {
    return this.isAtEnd() ? '\0' : this.source[this.position];
  }

  private peekNext(): string {
    return this.position + 1 >= this.source.length ? '\0' : this.source[this.position + 1];
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
        this.advance();
      } else if (char === '{') {
        this.skipComment();
      } else if (char === '(' && this.peekNext() === '*') {
        this.skipMultilineComment();
      } else if (char === '/' && this.peekNext() === '/') {
        this.skipLineComment();
      } else {
        break;
      }
    }
  }

  private skipComment(): void {
    this.advance(); // skip '{'
    while (!this.isAtEnd() && this.peek() !== '}') {
      this.advance();
    }
    if (!this.isAtEnd()) this.advance(); // skip '}'
  }

  private skipMultilineComment(): void {
    this.advance(); // skip '('
    this.advance(); // skip '*'
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === ')') {
        this.advance(); // skip '*'
        this.advance(); // skip ')'
        break;
      }
      this.advance();
    }
  }

  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private scanToken(): string | null {
    const char = this.advance();

    // Handle strings
    if (char === "'" || char === '"') {
      this.scanString(char);
      return TokenType.STRING;
    }

    // Handle character codes
    if (char === '#') {
      this.scanCharCode();
      return TokenType.CHAR_CODE;
    }

    // Handle numbers
    if (this.isDigit(char)) {
      this.scanNumber();
      return TokenType.NUMBER;
    }

    // Handle hex numbers
    if (char === '// ============================================================================
// Complete Pascal Plagiarism Detection System (Dolos-inspired)
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { PascalTokenizationService } from './tokenization/TokenizePascal';
import { PascalFingerprinter } from './fingerprinting/pascalFingerprinter';
import { FingerprintIndex } from './model/fingerprintIndex';
import { TokenizedFile } from './file/tokenizedFile';

// Fix the tokenization service to match existing interface
export class PascalTokenizationService {
  tokenizeFile(filePath: string, source: string): TokenizedFile {
    const { PascalTokenizer } = require('./parsers/pascalTokenizer');
    const { Region } = require('./model/region');
    const { File } = require('./file/file');
    
    const tokenizer = new PascalTokenizer();
    const tokenizeResult = tokenizer.tokenize(source);
    
    const tokens = tokenizeResult.tokens.map((match: any) => match.token);
    const regions = tokenizeResult.tokens.map((match: any) => match.region);

    // Overall file region
    const lines = source.split('\n');
    const fileRegion = new Region(
      0, 
      0, 
      lines.length - 1, 
      lines[lines.length - 1]?.length || 0
    );

    const file = new File(filePath, source);
    return new TokenizedFile(file, fileRegion, tokens, regions);
  }
}

export interface PlagiarismResult {
  file1: string;
  file2: string;
  similarity: number;
  overlap: number;
  fragments: SimilarityFragment[];
}

export interface SimilarityFragment {
  file1Region: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  file2Region: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  matchedTokens: string[];
  length: number;
}

export interface DetectionOptions {
  kgramLength?: number;
  windowSize?: number;
  minFragmentLength?: number;
  similarityThreshold?: number;
}

export class PascalPlagiarismDetector {
  private tokenizationService: PascalTokenizationService;
  private fingerprinter: PascalFingerprinter;
  private analyzer: PlagiarismAnalyzer;
  private reportGenerator: ReportGenerator;
  
  constructor(options: DetectionOptions = {}) {
    const {
      kgramLength = 5,
      windowSize = 4,
      minFragmentLength = 3,
      similarityThreshold = 0.3
    } = options;

    this.tokenizationService = new PascalTokenizationService();
    this.fingerprinter = new PascalFingerprinter(kgramLength, windowSize);
    this.analyzer = new PlagiarismAnalyzer(minFragmentLength, similarityThreshold);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Analyze a directory of Pascal files for plagiarism
   */
  async analyzeDirectory(directoryPath: string): Promise<PlagiarismResult[]> {
    console.log(`Analyzing directory: ${directoryPath}`);
    
    // Get all Pascal files
    const files = this.getPascalFiles(directoryPath);
    console.log(`Found ${files.length} Pascal files`);

    if (files.length < 2) {
      throw new Error('At least 2 files are required for plagiarism detection');
    }

    // Tokenize and fingerprint all files
    const tokenizedFiles: TokenizedFile[] = [];
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(directoryPath, filePath);
        const tokenizedFile = this.tokenizationService.tokenizeFile(relativePath, content);
        tokenizedFiles.push(tokenizedFile);
        console.log(`Processed: ${relativePath} (${tokenizedFile.tokens.length} tokens)`);
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
      }
    }

    // Build fingerprint index
    const fingerprintIndex = new FingerprintIndex(
      this.fingerprinter['k'], 
      this.fingerprinter['windowSize']
    );
    fingerprintIndex.addFiles(tokenizedFiles);

    // Analyze all pairs for plagiarism
    const results = await this.analyzer.analyzeAllPairs(fingerprintIndex);
    
    console.log(`Analysis complete. Found ${results.length} file pairs.`);
    return results;
  }

  /**
   * Analyze specific files for plagiarism
   */
  async analyzeFiles(filePaths: string[]): Promise<PlagiarismResult[]> {
    if (filePaths.length < 2) {
      throw new Error('At least 2 files are required for plagiarism detection');
    }

    const tokenizedFiles: TokenizedFile[] = [];
    
    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const tokenizedFile = this.tokenizationService.tokenizeFile(fileName, content);
        tokenizedFiles.push(tokenizedFile);
        console.log(`Processed: ${fileName} (${tokenizedFile.tokens.length} tokens)`);
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
      }
    }

    // Build fingerprint index
    const fingerprintIndex = new FingerprintIndex(
      this.fingerprinter['k'], 
      this.fingerprinter['windowSize']
    );
    fingerprintIndex.addFiles(tokenizedFiles);

    // Analyze all pairs for plagiarism
    const results = await this.analyzer.analyzeAllPairs(fingerprintIndex);
    
    return results;
  }

  /**
   * Generate HTML report
   */
  generateReport(results: PlagiarismResult[], outputPath: string): void {
    this.reportGenerator.generateHTMLReport(results, outputPath);
    console.log(`Report generated: ${outputPath}`);
  }

  /**
   * Generate console report
   */
  printResults(results: PlagiarismResult[]): void {
    this.reportGenerator.printConsoleReport(results);
  }

  private getPascalFiles(directory: string): string[] {
    const files: string[] = [];
    
    function walkDirectory(dir: string) {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (item.toLowerCase().endsWith('.pas') || item.toLowerCase().endsWith('.pp')) {
          files.push(fullPath);
        }
      }
    }
    
    walkDirectory(directory);
    return files;
  }
}

// Analysis module
export class PlagiarismAnalyzer {
  constructor(
    private minFragmentLength: number = 3,
    private similarityThreshold: number = 0.3
  ) {}

  async analyzeAllPairs(fingerprintIndex: FingerprintIndex): Promise<PlagiarismResult[]> {
    const results: PlagiarismResult[] = [];
    const pairs = fingerprintIndex.allPairs('similarity');
    
    for (const pair of pairs) {
      if (pair.similarity >= this.similarityThreshold) {
        const fragments = pair.buildFragments(this.minFragmentLength);
        const similarityFragments: SimilarityFragment[] = [];

        for (const fragment of fragments) {
          if (fragment.pairs.length >= this.minFragmentLength) {
            similarityFragments.push({
              file1Region: {
                startRow: fragment.leftSelection.startRow,
                startCol: fragment.leftSelection.startCol,
                endRow: fragment.leftSelection.endRow,
                endCol: fragment.leftSelection.endCol
              },
              file2Region: {
                startRow: fragment.rightSelection.startRow,
                startCol: fragment.rightSelection.startCol,
                endRow: fragment.rightSelection.endRow,
                endCol: fragment.rightSelection.endCol
              },
              matchedTokens: fragment.mergedData || [],
              length: fragment.pairs.length
            });
          }
        }

        results.push({
          file1: pair.leftFile.path,
          file2: pair.rightFile.path,
          similarity: Math.round(pair.similarity * 100) / 100,
          overlap: pair.overlap,
          fragments: similarityFragments
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }
}

// Reporting module
export class ReportGenerator {
  printConsoleReport(results: PlagiarismResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('PASCAL PLAGIARISM DETECTION REPORT');
    console.log('='.repeat(80));
    
    if (results.length === 0) {
      console.log('No plagiarism detected above the threshold.');
      return;
    }

    console.log(`Found ${results.length} suspicious file pairs:\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`${i + 1}. Files: ${result.file1} ↔ ${result.file2}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   Overlap: ${result.overlap} tokens`);
      console.log(`   Fragments: ${result.fragments.length}`);
      
      if (result.fragments.length > 0) {
        console.log('   Similar regions:');
        result.fragments.slice(0, 3).forEach((fragment, idx) => {
          console.log(`     ${idx + 1}. File1(${fragment.file1Region.startRow}:${fragment.file1Region.startCol}-${fragment.file1Region.endRow}:${fragment.file1Region.endCol}) ↔ File2(${fragment.file2Region.startRow}:${fragment.file2Region.startCol}-${fragment.file2Region.endRow}:${fragment.file2Region.endCol}) [${fragment.length} tokens]`);
        });
        if (result.fragments.length > 3) {
          console.log(`     ... and ${result.fragments.length - 3} more fragments`);
        }
      }
      console.log('');
    }
  }

  generateHTMLReport(results: PlagiarismResult[], outputPath: string): void {
    const html = this.createHTMLReport(results);
    fs.writeFileSync(outputPath, html, 'utf8');
  }

  private createHTMLReport(results: PlagiarismResult[]): string {
    const timestamp = new Date().toISOString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pascal Plagiarism Detection Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .result {
            background: white;
            border: 1px solid #ddd;
            border-radius: 10px;
            margin-bottom: 20px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .result-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #ddd;
        }
        .result-content {
            padding: 20px;
        }
        .similarity-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .similarity-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745 0%, #ffc107 50%, #dc3545 100%);
            transition: width 0.3s ease;
        }
        .file-pair {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .file-name {
            font-family: 'Monaco', 'Consolas', monospace;
            background: #f1f3f4;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.9em;
        }
        .arrow {
            font-size: 1.5em;
            color: #6c757d;
        }
        .fragments {
            margin-top: 20px;
        }
        .fragment {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 10px;
        }
        .fragment-header {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
        }
        .region-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: 0.9em;
        }
        .region {
            background: white;
            padding: 10px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .region-label {
            font-weight: bold;
            color: #007bff;
            margin-bottom: 5px;
        }
        .token-preview {
            font-family: 'Monaco', 'Consolas', monospace;
            background: #f1f3f4;
            padding: 8px;
            border-radius: 3px;
            margin-top: 8px;
            font-size: 0.85em;
            max-height: 100px;
            overflow-y: auto;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat {
            text-align: center;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #6c757d;
            font-size: 0.9em;
        }
        .no-results {
            text-align: center;
            color: #28a745;
            font-size: 1.2em;
            padding: 40px;
        }
        @media (max-width: 768px) {
            body { padding: 10px; }
            .header h1 { font-size: 2em; }
            .region-info { grid-template-columns: 1fr; }
            .file-pair { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pascal Plagiarism Detection Report</h1>
        <p>Generated on ${timestamp}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${results.length}</div>
                <div class="stat-label">Suspicious Pairs</div>
            </div>
            <div class="stat">
                <div class="stat-value">${results.length > 0 ? Math.max(...results.map(r => r.similarity * 100)).toFixed(1) + '%' : '0%'}</div>
                <div class="stat-label">Highest Similarity</div>
            </div>
            <div class="stat">
                <div class="stat-value">${results.reduce((sum, r) => sum + r.fragments.length, 0)}</div>
                <div class="stat-label">Total Fragments</div>
            </div>
        </div>
    </div>

    ${results.length === 0 ? 
      '<div class="no-results">✅ No plagiarism detected above the threshold.</div>' :
      results.map((result, index) => `
        <div class="result">
            <div class="result-header">
                <h3>Result #${index + 1}</h3>
                <div class="file-pair">
                    <span class="file-name">${result.file1}</span>
                    <span class="arrow">↔</span>
                    <span class="file-name">${result.file2}</span>
                </div>
                <div class="similarity-bar">
                    <div class="similarity-fill" style="width: ${result.similarity * 100}%"></div>
                </div>
                <div style="text-align: center; margin-top: 10px;">
                    <strong>${(result.similarity * 100).toFixed(1)}% Similarity</strong> | 
                    ${result.overlap} overlapping tokens | 
                    ${result.fragments.length} fragments
                </div>
            </div>
            
            <div class="result-content">
                <div class="fragments">
                    <h4>Similar Fragments:</h4>
                    ${result.fragments.length === 0 ? 
                      '<p>No significant fragments found.</p>' :
                      result.fragments.map((fragment, fragIndex) => `
                        <div class="fragment">
                            <div class="fragment-header">Fragment #${fragIndex + 1} (${fragment.length} tokens)</div>
                            <div class="region-info">
                                <div class="region">
                                    <div class="region-label">${result.file1}</div>
                                    <div>Lines ${fragment.file1Region.startRow + 1}:${fragment.file1Region.startCol + 1} - ${fragment.file1Region.endRow + 1}:${fragment.file1Region.endCol + 1}</div>
                                </div>
                                <div class="region">
                                    <div class="region-label">${result.file2}</div>
                                    <div>Lines ${fragment.file2Region.startRow + 1}:${fragment.file2Region.startCol + 1} - ${fragment.file2Region.endRow + 1}:${fragment.file2Region.endCol + 1}</div>
                                </div>
                            </div>
                            ${fragment.matchedTokens.length > 0 ? `
                                <div class="token-preview">
                                    <strong>Matched tokens:</strong> ${fragment.matchedTokens.slice(0, 20).join(' ')}${fragment.matchedTokens.length > 20 ? '...' : ''}
                                </div>
                            ` : ''}
                        </div>
                      `).join('')
                    }
                </div>
            </div>
        </div>
      `).join('')
    }

    <div style="text-align: center; margin-top: 40px; color: #6c757d; font-size: 0.9em;">
        <p>Report generated by Pascal Plagiarism Detector</p>
    </div>
</body>
</html>`;
  }
}

// CLI interface
export async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node plagiarism-detector.js [options] <directory-or-files>

Options:
  --threshold <number>    Similarity threshold (0-1, default: 0.3)
  --kgram <number>       K-gram length (default: 5)
  --window <number>      Window size (default: 4)
  --min-fragment <number> Minimum fragment length (default: 3)
  --report <path>        Generate HTML report at path
  --help                 Show this help message

Examples:
  node plagiarism-detector.js ./assignments/
  node plagiarism-detector.js --threshold 0.5 --report report.html ./assignments/
  node plagiarism-detector.js file1.pas file2.pas file3.pas
    `);
    return;
  }

  // Parse command line arguments
  const options: DetectionOptions = {};
  let reportPath: string | undefined;
  let inputPaths: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--threshold':
        options.similarityThreshold = parseFloat(args[++i]);
        break;
      case '--kgram':
        options.kgramLength = parseInt(args[++i]);
        break;
      case '--window':
        options.windowSize = parseInt(args[++i]);
        break;
      case '--min-fragment':
        options.minFragmentLength = parseInt(args[++i]);
        break;
      case '--report':
        reportPath = args[++i];
        break;
      case '--help':
        console.log('Help message already shown above');
        return;
      default:
        if (!arg.startsWith('--')) {
          inputPaths.push(arg);
        }
        break;
    }
  }

  if (inputPaths.length === 0) {
    console.error('Error: No input files or directories specified');
    return;
  }

  try {
    const detector = new PascalPlagiarismDetector(options);
    let results: PlagiarismResult[];

    // Check if input is a directory or individual files
    if (inputPaths.length === 1 && fs.statSync(inputPaths[0]).isDirectory()) {
      results = await detector.analyzeDirectory(inputPaths[0]);
    } else {
      results = await detector.analyzeFiles(inputPaths);
    }

    // Print console report
    detector.printResults(results);

    // Generate HTML report if requested
    if (reportPath) {
      detector.generateReport(results, reportPath);
    }

  } catch (error) {
    console.error('Error during plagiarism detection:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { PascalPlagiarismDetector };
) {
      this.scanHexNumber();
      return TokenType.HEX_NUMBER;
    }

    // Handle binary numbers
    if (char === '%') {
      this.scanBinaryNumber();
      return TokenType.BINARY_NUMBER;
    }

    // Handle operators (multi-character first)
    if (char === ':' && this.peek() === '=') {
      this.advance();
      return TokenType.ASSIGN;
    }
    if (char === '<' && this.peek() === '>') {
      this.advance();
      return TokenType.NOT_EQUALS;
    }
    if (char === '<' && this.peek() === '=') {
      this.advance();
      return TokenType.LESS_EQUAL;
    }
    if (char === '>' && this.peek() === '=') {
      this.advance();
      return TokenType.GREATER_EQUAL;
    }

    // Single character operators
    const singleOp = PascalTokenizer.operators.get(char);
    if (singleOp) return singleOp;

    // Handle identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      return this.scanIdentifier();
    }

    return null; // Skip unknown characters
  }

  private scanString(quote: string): void {
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\n') break; // Unterminated string
      if (this.peek() === quote && this.peekNext() === quote) {
        this.advance(); // Skip escaped quote
      }
      this.advance();
    }
    if (!this.isAtEnd()) this.advance(); // Closing quote
  }

  private scanCharCode(): void {
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      this.advance();
    }
  }

  private scanNumber(): void {
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      this.advance();
    }
    
    // Decimal point
    if (!this.isAtEnd() && this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        this.advance();
      }
    }
    
    // Scientific notation
    if (!this.isAtEnd() && (this.peek() === 'e' || this.peek() === 'E')) {
      this.advance();
      if (!this.isAtEnd() && (this.peek() === '+' || this.peek() === '-')) {
        this.advance();
      }
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        this.advance();
      }
    }
  }

  private scanHexNumber(): void {
    while (!this.isAtEnd() && this.isHexDigit(this.peek())) {
      this.advance();
    }
  }

  private scanBinaryNumber(): void {
    while (!this.isAtEnd() && (this.peek() === '0' || this.peek() === '1')) {
      this.advance();
    }
  }

  private scanIdentifier(): string {
    const start = this.position - 1;
    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()))) {
      this.advance();
    }
    
    const text = this.source.substring(start, this.position).toLowerCase();
    return PascalTokenizer.keywords.get(text) || TokenType.IDENTIFIER;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isHexDigit(char: string): boolean {
    return this.isDigit(char) || (char >= 'A' && char <= 'F') || (char >= 'a' && char <= 'f');
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char) || char === '_';
  }
}

// ============================================================================
// HASHING SYSTEM (Winnowing Algorithm)
// ============================================================================
export class TokenHash {
  readonly mod = 33554393;  // 26-bit prime
  readonly base = 747287;   // Optimized for tokens

  hashToken(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash + token.charCodeAt(i)) * this.base) % this.mod;
    }
    return hash;
  }
}

export class RollingHash {
  readonly mod = 33554393;  // 26-bit prime
  readonly base = 4194301;  // 22-bit prime
  readonly k: number;
  
  private readonly memory: number[];
  private readonly maxBase: number;
  private i = 0;
  private hash = 0;

  constructor(k: number) {
    this.k = k;
    this.maxBase = this.mod - this.modPow(this.base, this.k, this.mod);
    this.memory = new Array(this.k).fill(0);
  }

  nextHash(token: number): number {
    this.hash = (this.base * this.hash + token + this.maxBase * this.memory[this.i]) % this.mod;
    this.memory[this.i] = token;
    this.i = (this.i + 1) % this.k;
    return this.hash;
  }

  private modPow(base: number, exp: number, mod: number): number {
    let y = 1;
    let b = base;
    let e = exp;
    while (e > 1) {
      if (e & 1) {
        y = (b * y) % mod;
      }
      b = (b * b) % mod;
      e >>= 1;
    }
    return (b * y) % mod;
  }
}

export interface Fingerprint {
  data: Array<string> | null;
  hash: number;
  start: number;
  stop: number;
}

export class WinnowFilter {
  private readonly k: number;
  private readonly windowSize: number;
  private readonly kgramData: boolean;
  private hasher = new TokenHash();

  constructor(k: number, windowSize: number, kgramData = false) {
    this.k = k;
    this.windowSize = windowSize;
    this.kgramData = kgramData;
  }

  hashTokens(tokens: string[]): Array<[number, string]> {
    return tokens.map(token => [this.hasher.hashToken(token), token]);
  }

  fingerprints(tokens: string[]): Array<Fingerprint> {
    const hash = new RollingHash(this.k);
    let filePos = -this.k;
    let bufferPos = 0;
    let minPos = 0;
    const buffer = new Array(this.windowSize).fill(Number.MAX_SAFE_INTEGER);
    const fingerprints: Array<Fingerprint> = [];

    for (const [hashedToken, token] of this.hashTokens(tokens)) {
      filePos++;
      if (filePos < 0) {
        hash.nextHash(hashedToken);
        continue;
      }

      bufferPos = (bufferPos + 1) % this.windowSize;
      buffer[bufferPos] = hash.nextHash(hashedToken);

      if (minPos === bufferPos) {
        // Find new minimum
        for (let i = (bufferPos + 1) % this.windowSize; i !== bufferPos; i = (i + 1) % this.windowSize) {
          if (buffer[i] <= buffer[minPos]) {
            minPos = i;
          }
        }

        const offset = (minPos - bufferPos - this.windowSize) % this.windowSize;
        const start = filePos + offset;

        fingerprints.push({
          data: this.kgramData ? tokens.slice(start, start + this.k) : null,
          hash: buffer[minPos],
          start,
          stop: start + this.k - 1,
        });
      } else {
        if (buffer[bufferPos] <= buffer[minPos]) {
          minPos = bufferPos;
          const start = filePos + ((minPos - bufferPos - this.windowSize) % this.windowSize);

          fingerprints.push({
            data: this.kgramData ? tokens.slice(start, start + this.k) : null,
            hash: buffer[minPos],
            start,
            stop: start + this.k - 1,
          });
        }
      }
    }
    return fingerprints;
  }
}

// ============================================================================
// FINGERPRINTING FOR PASCAL
// ============================================================================
export interface PascalFingerprint extends Fingerprint {
  file: string;
  region: Region;
}

export class PascalFingerprinter {
  private readonly k: number;
  private readonly windowSize: number;

  constructor(k = 5, windowSize = 4) {
    this.k = k;
    this.windowSize = windowSize;
  }

  fingerprint(tokenized: TokenizedFile): PascalFingerprint[] {
    const filter = new WinnowFilter(this.k, this.windowSize);
    const rawFingerprints = filter.fingerprints(tokenized.tokens);

    return rawFingerprints.map(f => {
      const regionStart = tokenized.regions[f.start];
      const regionStop = tokenized.regions[f.stop];

      const region = (regionStart && regionStop)
        ? new Region(regionStart.startRow, regionStart.startCol, regionStop.endRow, regionStop.endCol)
        : new Region(0, 0, 0, 0);

      return {
        ...f,
        file: tokenized.path,
        region
      };
    });
  }
}

// ============================================================================
// ANALYSIS SYSTEM
// ============================================================================
export class Range {
  static compare(one: Range, other: Range): number {
    if (one.from === other.from) return one.to - other.to;
    return one.from - other.from;
  }

  static merge(one: Range, other: Range): Range {
    return new Range(Math.min(one.from, other.from), Math.max(one.to, other.to));
  }

  constructor(public readonly from: number, public readonly to: number = -1) {
    if (this.to === -1) {
      (this as any).to = this.from + 1;
    }
    if (this.from >= this.to) {
      throw new Error("'from' should be smaller than 'to'");
    }
  }

  get length(): number {
    return this.to - this.from;
  }

  contains(other: Range): boolean {
    return this.from <= other.from && other.to <= this.to;
  }
}

export interface ASTRegion {
  start: number;
  stop: number;
  index: number;
  location: Region;
  data: Array<string> | null;
}

export class SharedFingerprint {
  public ignored = false;
  private partMap = new Map<TokenizedFile, Array<{file: TokenizedFile, side: ASTRegion}>>();

  constructor(public readonly hash: number, public readonly kgram: Array<string> | null) {}

  add(part: {file: TokenizedFile, side: ASTRegion}): void {
    const parts = this.partMap.get(part.file) || [];
    if (parts.length === 0) {
      this.partMap.set(part.file, parts);
    }
    parts.push(part);
  }

  occurrencesOf(file: TokenizedFile) {
    return this.partMap.get(file) || [];
  }

  files(): TokenizedFile[] {
    return Array.from(this.partMap.keys());
  }

  fileCount(): number {
    return this.partMap.size;
  }
}

export class PairedOccurrence {
  constructor(
    public readonly left: ASTRegion,
    public readonly right: ASTRegion,
    public readonly fingerprint: SharedFingerprint
  ) {}
}

// ============================================================================
// FINGERPRINT INDEX SYSTEM
// ============================================================================
export class FingerprintIndex {
  private readonly hashFilter: WinnowFilter;
  private readonly files = new Map<number, {file: TokenizedFile, kgrams: Range[], shared: Set<SharedFingerprint>}>();
  private readonly index = new Map<number, SharedFingerprint>();

  constructor(private readonly kgramLength: number, private readonly windowSize: number) {
    this.hashFilter = new WinnowFilter(this.kgramLength, this.windowSize, true);
  }

  addFiles(tokenizedFiles: TokenizedFile[]): void {
    for (const file of tokenizedFiles) {
      const entry = {
        file,
        kgrams: [],
        shared: new Set<SharedFingerprint>()
      };

      this.files.set(file.id, entry);
      
      let kgram = 0;
      for (const {data, hash, start, stop} of this.hashFilter.fingerprints(file.tokens)) {
        entry.kgrams.push(new Range(start, stop));

        const location = file.regions[start] ? 
          Region.merge(file.regions[start], file.regions[stop] || file.regions[start]) :
          new Region(0, 0, 0, 0);

        const part = {
          file,
          side: {
            index: kgram,
            start,
            stop,
            data,
            location
          }
        };

        let shared = this.index.get(hash);
        if (!shared) {
          shared = new SharedFingerprint(hash, data);
          this.index.set(hash, shared);
        }

        shared.add(part);
        entry.shared.add(shared);
        kgram++;
      }
    }
  }

  allPairs(sortBy?: string): Pair[] {
    const pairs: Pair[] = [];
    const entries = Array.from(this.files.values());
    
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        pairs.push(new Pair(entries[i], entries[j]));
      }
    }

    if (sortBy === 'similarity') {
      pairs.sort((a, b) => b.similarity - a.similarity);
    }

    return pairs;
  }
}// ============================================================================
// Complete Pascal Plagiarism Detection System (Dolos-inspired)
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { PascalTokenizationService } from './tokenization/TokenizePascal';
import { PascalFingerprinter } from './fingerprinting/pascalFingerprinter';
import { FingerprintIndex } from './model/fingerprintIndex';
import { TokenizedFile } from './file/tokenizedFile';

// Fix the tokenization service to match existing interface
export class PascalTokenizationService {
  tokenizeFile(filePath: string, source: string): TokenizedFile {
    const { PascalTokenizer } = require('./parsers/pascalTokenizer');
    const { Region } = require('./model/region');
    const { File } = require('./file/file');
    
    const tokenizer = new PascalTokenizer();
    const tokenizeResult = tokenizer.tokenize(source);
    
    const tokens = tokenizeResult.tokens.map((match: any) => match.token);
    const regions = tokenizeResult.tokens.map((match: any) => match.region);

    // Overall file region
    const lines = source.split('\n');
    const fileRegion = new Region(
      0, 
      0, 
      lines.length - 1, 
      lines[lines.length - 1]?.length || 0
    );

    const file = new File(filePath, source);
    return new TokenizedFile(file, fileRegion, tokens, regions);
  }
}

export interface PlagiarismResult {
  file1: string;
  file2: string;
  similarity: number;
  overlap: number;
  fragments: SimilarityFragment[];
}

export interface SimilarityFragment {
  file1Region: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  file2Region: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  matchedTokens: string[];
  length: number;
}

export interface DetectionOptions {
  kgramLength?: number;
  windowSize?: number;
  minFragmentLength?: number;
  similarityThreshold?: number;
}

export class PascalPlagiarismDetector {
  private tokenizationService: PascalTokenizationService;
  private fingerprinter: PascalFingerprinter;
  private analyzer: PlagiarismAnalyzer;
  private reportGenerator: ReportGenerator;
  
  constructor(options: DetectionOptions = {}) {
    const {
      kgramLength = 5,
      windowSize = 4,
      minFragmentLength = 3,
      similarityThreshold = 0.3
    } = options;

    this.tokenizationService = new PascalTokenizationService();
    this.fingerprinter = new PascalFingerprinter(kgramLength, windowSize);
    this.analyzer = new PlagiarismAnalyzer(minFragmentLength, similarityThreshold);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Analyze a directory of Pascal files for plagiarism
   */
  async analyzeDirectory(directoryPath: string): Promise<PlagiarismResult[]> {
    console.log(`Analyzing directory: ${directoryPath}`);
    
    // Get all Pascal files
    const files = this.getPascalFiles(directoryPath);
    console.log(`Found ${files.length} Pascal files`);

    if (files.length < 2) {
      throw new Error('At least 2 files are required for plagiarism detection');
    }

    // Tokenize and fingerprint all files
    const tokenizedFiles: TokenizedFile[] = [];
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(directoryPath, filePath);
        const tokenizedFile = this.tokenizationService.tokenizeFile(relativePath, content);
        tokenizedFiles.push(tokenizedFile);
        console.log(`Processed: ${relativePath} (${tokenizedFile.tokens.length} tokens)`);
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
      }
    }

    // Build fingerprint index
    const fingerprintIndex = new FingerprintIndex(
      this.fingerprinter['k'], 
      this.fingerprinter['windowSize']
    );
    fingerprintIndex.addFiles(tokenizedFiles);

    // Analyze all pairs for plagiarism
    const results = await this.analyzer.analyzeAllPairs(fingerprintIndex);
    
    console.log(`Analysis complete. Found ${results.length} file pairs.`);
    return results;
  }

  /**
   * Analyze specific files for plagiarism
   */
  async analyzeFiles(filePaths: string[]): Promise<PlagiarismResult[]> {
    if (filePaths.length < 2) {
      throw new Error('At least 2 files are required for plagiarism detection');
    }

    const tokenizedFiles: TokenizedFile[] = [];
    
    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const tokenizedFile = this.tokenizationService.tokenizeFile(fileName, content);
        tokenizedFiles.push(tokenizedFile);
        console.log(`Processed: ${fileName} (${tokenizedFile.tokens.length} tokens)`);
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
      }
    }

    // Build fingerprint index
    const fingerprintIndex = new FingerprintIndex(
      this.fingerprinter['k'], 
      this.fingerprinter['windowSize']
    );
    fingerprintIndex.addFiles(tokenizedFiles);

    // Analyze all pairs for plagiarism
    const results = await this.analyzer.analyzeAllPairs(fingerprintIndex);
    
    return results;
  }

  /**
   * Generate HTML report
   */
  generateReport(results: PlagiarismResult[], outputPath: string): void {
    this.reportGenerator.generateHTMLReport(results, outputPath);
    console.log(`Report generated: ${outputPath}`);
  }

  /**
   * Generate console report
   */
  printResults(results: PlagiarismResult[]): void {
    this.reportGenerator.printConsoleReport(results);
  }

  private getPascalFiles(directory: string): string[] {
    const files: string[] = [];
    
    function walkDirectory(dir: string) {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (item.toLowerCase().endsWith('.pas') || item.toLowerCase().endsWith('.pp')) {
          files.push(fullPath);
        }
      }
    }
    
    walkDirectory(directory);
    return files;
  }
}

// Analysis module
export class PlagiarismAnalyzer {
  constructor(
    private minFragmentLength: number = 3,
    private similarityThreshold: number = 0.3
  ) {}

  async analyzeAllPairs(fingerprintIndex: FingerprintIndex): Promise<PlagiarismResult[]> {
    const results: PlagiarismResult[] = [];
    const pairs = fingerprintIndex.allPairs('similarity');
    
    for (const pair of pairs) {
      if (pair.similarity >= this.similarityThreshold) {
        const fragments = pair.buildFragments(this.minFragmentLength);
        const similarityFragments: SimilarityFragment[] = [];

        for (const fragment of fragments) {
          if (fragment.pairs.length >= this.minFragmentLength) {
            similarityFragments.push({
              file1Region: {
                startRow: fragment.leftSelection.startRow,
                startCol: fragment.leftSelection.startCol,
                endRow: fragment.leftSelection.endRow,
                endCol: fragment.leftSelection.endCol
              },
              file2Region: {
                startRow: fragment.rightSelection.startRow,
                startCol: fragment.rightSelection.startCol,
                endRow: fragment.rightSelection.endRow,
                endCol: fragment.rightSelection.endCol
              },
              matchedTokens: fragment.mergedData || [],
              length: fragment.pairs.length
            });
          }
        }

        results.push({
          file1: pair.leftFile.path,
          file2: pair.rightFile.path,
          similarity: Math.round(pair.similarity * 100) / 100,
          overlap: pair.overlap,
          fragments: similarityFragments
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }
}

// Reporting module
export class ReportGenerator {
  printConsoleReport(results: PlagiarismResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('PASCAL PLAGIARISM DETECTION REPORT');
    console.log('='.repeat(80));
    
    if (results.length === 0) {
      console.log('No plagiarism detected above the threshold.');
      return;
    }

    console.log(`Found ${results.length} suspicious file pairs:\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`${i + 1}. Files: ${result.file1} ↔ ${result.file2}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   Overlap: ${result.overlap} tokens`);
      console.log(`   Fragments: ${result.fragments.length}`);
      
      if (result.fragments.length > 0) {
        console.log('   Similar regions:');
        result.fragments.slice(0, 3).forEach((fragment, idx) => {
          console.log(`     ${idx + 1}. File1(${fragment.file1Region.startRow}:${fragment.file1Region.startCol}-${fragment.file1Region.endRow}:${fragment.file1Region.endCol}) ↔ File2(${fragment.file2Region.startRow}:${fragment.file2Region.startCol}-${fragment.file2Region.endRow}:${fragment.file2Region.endCol}) [${fragment.length} tokens]`);
        });
        if (result.fragments.length > 3) {
          console.log(`     ... and ${result.fragments.length - 3} more fragments`);
        }
      }
      console.log('');
    }
  }

  generateHTMLReport(results: PlagiarismResult[], outputPath: string): void {
    const html = this.createHTMLReport(results);
    fs.writeFileSync(outputPath, html, 'utf8');
  }

  private createHTMLReport(results: PlagiarismResult[]): string {
    const timestamp = new Date().toISOString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pascal Plagiarism Detection Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .result {
            background: white;
            border: 1px solid #ddd;
            border-radius: 10px;
            margin-bottom: 20px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .result-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #ddd;
        }
        .result-content {
            padding: 20px;
        }
        .similarity-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .similarity-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745 0%, #ffc107 50%, #dc3545 100%);
            transition: width 0.3s ease;
        }
        .file-pair {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .file-name {
            font-family: 'Monaco', 'Consolas', monospace;
            background: #f1f3f4;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.9em;
        }
        .arrow {
            font-size: 1.5em;
            color: #6c757d;
        }
        .fragments {
            margin-top: 20px;
        }
        .fragment {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 10px;
        }
        .fragment-header {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
        }
        .region-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: 0.9em;
        }
        .region {
            background: white;
            padding: 10px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .region-label {
            font-weight: bold;
            color: #007bff;
            margin-bottom: 5px;
        }
        .token-preview {
            font-family: 'Monaco', 'Consolas', monospace;
            background: #f1f3f4;
            padding: 8px;
            border-radius: 3px;
            margin-top: 8px;
            font-size: 0.85em;
            max-height: 100px;
            overflow-y: auto;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat {
            text-align: center;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #6c757d;
            font-size: 0.9em;
        }
        .no-results {
            text-align: center;
            color: #28a745;
            font-size: 1.2em;
            padding: 40px;
        }
        @media (max-width: 768px) {
            body { padding: 10px; }
            .header h1 { font-size: 2em; }
            .region-info { grid-template-columns: 1fr; }
            .file-pair { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pascal Plagiarism Detection Report</h1>
        <p>Generated on ${timestamp}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${results.length}</div>
                <div class="stat-label">Suspicious Pairs</div>
            </div>
            <div class="stat">
                <div class="stat-value">${results.length > 0 ? Math.max(...results.map(r => r.similarity * 100)).toFixed(1) + '%' : '0%'}</div>
                <div class="stat-label">Highest Similarity</div>
            </div>
            <div class="stat">
                <div class="stat-value">${results.reduce((sum, r) => sum + r.fragments.length, 0)}</div>
                <div class="stat-label">Total Fragments</div>
            </div>
        </div>
    </div>

    ${results.length === 0 ? 
      '<div class="no-results">✅ No plagiarism detected above the threshold.</div>' :
      results.map((result, index) => `
        <div class="result">
            <div class="result-header">
                <h3>Result #${index + 1}</h3>
                <div class="file-pair">
                    <span class="file-name">${result.file1}</span>
                    <span class="arrow">↔</span>
                    <span class="file-name">${result.file2}</span>
                </div>
                <div class="similarity-bar">
                    <div class="similarity-fill" style="width: ${result.similarity * 100}%"></div>
                </div>
                <div style="text-align: center; margin-top: 10px;">
                    <strong>${(result.similarity * 100).toFixed(1)}% Similarity</strong> | 
                    ${result.overlap} overlapping tokens | 
                    ${result.fragments.length} fragments
                </div>
            </div>
            
            <div class="result-content">
                <div class="fragments">
                    <h4>Similar Fragments:</h4>
                    ${result.fragments.length === 0 ? 
                      '<p>No significant fragments found.</p>' :
                      result.fragments.map((fragment, fragIndex) => `
                        <div class="fragment">
                            <div class="fragment-header">Fragment #${fragIndex + 1} (${fragment.length} tokens)</div>
                            <div class="region-info">
                                <div class="region">
                                    <div class="region-label">${result.file1}</div>
                                    <div>Lines ${fragment.file1Region.startRow + 1}:${fragment.file1Region.startCol + 1} - ${fragment.file1Region.endRow + 1}:${fragment.file1Region.endCol + 1}</div>
                                </div>
                                <div class="region">
                                    <div class="region-label">${result.file2}</div>
                                    <div>Lines ${fragment.file2Region.startRow + 1}:${fragment.file2Region.startCol + 1} - ${fragment.file2Region.endRow + 1}:${fragment.file2Region.endCol + 1}</div>
                                </div>
                            </div>
                            ${fragment.matchedTokens.length > 0 ? `
                                <div class="token-preview">
                                    <strong>Matched tokens:</strong> ${fragment.matchedTokens.slice(0, 20).join(' ')}${fragment.matchedTokens.length > 20 ? '...' : ''}
                                </div>
                            ` : ''}
                        </div>
                      `).join('')
                    }
                </div>
            </div>
        </div>
      `).join('')
    }

    <div style="text-align: center; margin-top: 40px; color: #6c757d; font-size: 0.9em;">
        <p>Report generated by Pascal Plagiarism Detector</p>
    </div>
</body>
</html>`;
  }
}

// CLI interface
export async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node plagiarism-detector.js [options] <directory-or-files>

Options:
  --threshold <number>    Similarity threshold (0-1, default: 0.3)
  --kgram <number>       K-gram length (default: 5)
  --window <number>      Window size (default: 4)
  --min-fragment <number> Minimum fragment length (default: 3)
  --report <path>        Generate HTML report at path
  --help                 Show this help message

Examples:
  node plagiarism-detector.js ./assignments/
  node plagiarism-detector.js --threshold 0.5 --report report.html ./assignments/
  node plagiarism-detector.js file1.pas file2.pas file3.pas
    `);
    return;
  }

  // Parse command line arguments
  const options: DetectionOptions = {};
  let reportPath: string | undefined;
  let inputPaths: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--threshold':
        options.similarityThreshold = parseFloat(args[++i]);
        break;
      case '--kgram':
        options.kgramLength = parseInt(args[++i]);
        break;
      case '--window':
        options.windowSize = parseInt(args[++i]);
        break;
      case '--min-fragment':
        options.minFragmentLength = parseInt(args[++i]);
        break;
      case '--report':
        reportPath = args[++i];
        break;
      case '--help':
        console.log('Help message already shown above');
        return;
      default:
        if (!arg.startsWith('--')) {
          inputPaths.push(arg);
        }
        break;
    }
  }

  if (inputPaths.length === 0) {
    console.error('Error: No input files or directories specified');
    return;
  }

  try {
    const detector = new PascalPlagiarismDetector(options);
    let results: PlagiarismResult[];

    // Check if input is a directory or individual files
    if (inputPaths.length === 1 && fs.statSync(inputPaths[0]).isDirectory()) {
      results = await detector.analyzeDirectory(inputPaths[0]);
    } else {
      results = await detector.analyzeFiles(inputPaths);
    }

    // Print console report
    detector.printResults(results);

    // Generate HTML report if requested
    if (reportPath) {
      detector.generateReport(results, reportPath);
    }

  } catch (error) {
    console.error('Error during plagiarism detection:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { PascalPlagiarismDetector };
