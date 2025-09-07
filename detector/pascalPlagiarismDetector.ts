// detector/pascalPlagiarismDetector.ts
import { PascalTokenizer } from '../tokenizer/tokenizer';
// import { SemanticAnalyzer, SemanticFeatures, SemanticSimilarity } from '../semantic/semanticAnalyzer';
import { FingerprintIndex } from '../algorithm/fingerprintIndex';
import { TokenizedFile } from '../file/tokenizedFile';
import { File } from '../file/file';
import { Pair } from '../algorithm/pair';

export interface PlagiarismResult {
  // Basic similarity metrics
  syntacticSimilarity: number;
  //semanticSimilarity: number;
  overallSimilarity: number;
  
  // Detailed analysis
  sharedFragments: number;
  longestFragment: number;
  coverage1: number;
  coverage2: number;
  
  // Semantic analysis
  // semanticDetails: SemanticSimilarity;
  
  // Plagiarism assessment
  isPlagiarism: boolean;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  
  // Additional info
  file1: string;
  file2: string;
  processingTime: number;
}

export interface BatchResult {
  results: PlagiarismResult[];
  threshold: number;
  totalComparisons: number;
  suspiciousPairs: number;
  processingTime: number;
}

export interface FileInput {
  name: string;
  content: string;
  metadata?: {
    author?: string;
    timestamp?: Date;
    language?: string;
  };
}

export class PascalPlagiarismDetector {
  private tokenizer: PascalTokenizer;
  // private semanticAnalyzer: SemanticAnalyzer;
  private initialized = false;

  // Algorithm parameters
  private kgramSize: number;
  private windowSize: number;
  // private semanticWeight: number;
  private syntacticWeight: number;

  constructor(
    kgramSize = 8,
    windowSize = 15,
    // semanticWeight = 0.4,
    syntacticWeight = 1.0  // Changed to 1.0 since we're only using syntactic
  ) {
    this.kgramSize = kgramSize;
    this.windowSize = windowSize;
    // this.semanticWeight = semanticWeight;
    this.syntacticWeight = syntacticWeight;
    
    this.tokenizer = new PascalTokenizer();
    // this.semanticAnalyzer = new SemanticAnalyzer();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log(' Initializing Pascal Plagiarism Detector...');
    
    try {
        this.tokenizer = new PascalTokenizer();
       // this.semanticAnalyzer = new SemanticAnalyzer();
      //await this.tokenizer.initialize();
      //await this.semanticAnalyzer.initialize();
      this.initialized = true;
      console.log('✅ Pascal Plagiarism Detector initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize detector:', error);
      throw error;
    }
  }

  /**
   * Compare two Pascal files for plagiarism
   */
  public async detectPlagiarism(
    file1: FileInput,
    file2: FileInput,
    customThreshold?: number
  ): Promise<PlagiarismResult> {
    const startTime = performance.now();
    
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Analyzing ${file1.name} vs ${file2.name}...`);

    // Step 1: Tokenize both files
    const tokenizedFile1 = this.tokenizer.tokenizeFile(file1.name, file1.content);
    const tokenizedFile2 = this.tokenizer.tokenizeFile(file2.name, file2.content);

    console.log(` File 1: ${tokenizedFile1.tokens.length} tokens`);
    console.log(` File 2: ${tokenizedFile2.tokens.length} tokens`);

    // Step 2: Syntactic analysis using Dolos-inspired algorithm
    const syntacticResult = this.performSyntacticAnalysis([tokenizedFile1, tokenizedFile2]);
    
    // Step 3: Semantic analysis
    //const semanticResult = await this.performSemanticAnalysis(tokenizedFile1, tokenizedFile2);

    // Step 4: Combine results - now only using syntactic
    const overallSimilarity = syntacticResult.similarity * this.syntacticWeight;
      // syntacticResult.similarity * this.syntacticWeight +
     // semanticResult.overallSemanticSimilarity * this.semanticWeight

    // Step 5: Determine plagiarism verdict
    const threshold = customThreshold ?? this.calculateAdaptiveThreshold(syntacticResult.similarity);
    const isPlagiarism = overallSimilarity >= threshold;
    const confidence = this.determineConfidence(overallSimilarity, syntacticResult);

    const processingTime = performance.now() - startTime;

    console.log(`Syntactic similarity: ${(syntacticResult.similarity * 100).toFixed(1)}%`);
    //console.log(`Semantic similarity: ${(semanticResult.overallSemanticSimilarity * 100).toFixed(1)}%`);
    console.log(`Overall similarity: ${(overallSimilarity * 100).toFixed(1)}%`);
    console.log(` Plagiarism detected: ${isPlagiarism ? 'YES' : 'NO'} (${confidence} confidence)`);

    return {
      syntacticSimilarity: syntacticResult.similarity,
     // semanticSimilarity: semanticResult.overallSemanticSimilarity,
      overallSimilarity,
      
      sharedFragments: syntacticResult.sharedFingerprints,
      longestFragment: syntacticResult.longestFragment,
      coverage1: syntacticResult.coverage1,
      coverage2: syntacticResult.coverage2,
      
      //semanticDetails: semanticResult,
      
      isPlagiarism,
      confidence,
      
      file1: file1.name,
      file2: file2.name,
      processingTime
    };
  }

  /**
   * Batch analysis of multiple files
   */
  public async detectBatchPlagiarism(
    files: FileInput[],
    customThreshold?: number
  ): Promise<BatchResult> {
    const startTime = performance.now();
    
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`🔍 Batch analysis of ${files.length} files (${files.length * (files.length - 1) / 2} comparisons)...`);

    const results: PlagiarismResult[] = [];
    let totalComparisons = 0;
    let suspiciousPairs = 0;

    // Compare all pairs
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        totalComparisons++;
        console.log(`📋 Comparing ${files[i].name} vs ${files[j].name} (${totalComparisons}/${files.length * (files.length - 1) / 2})`);
        
        const result = await this.detectPlagiarism(files[i], files[j], customThreshold);
        results.push(result);
        
        if (result.isPlagiarism) {
          suspiciousPairs++;
        }
      }
    }

    // Calculate adaptive threshold if not provided
    const threshold = customThreshold ?? this.calculateBatchThreshold(results);
    
    const processingTime = performance.now() - startTime;

    console.log(`\n📈 Batch Analysis Summary:`);
    console.log(`   Total comparisons: ${totalComparisons}`);
    console.log(`   Suspicious pairs: ${suspiciousPairs}`);
    console.log(`   Threshold: ${(threshold * 100).toFixed(1)}%`);
    console.log(`   Processing time: ${processingTime.toFixed(2)}ms`);

    return {
      results: results.sort((a, b) => b.overallSimilarity - a.overallSimilarity),
      threshold,
      totalComparisons,
      suspiciousPairs,
      processingTime
    };
  }

  private performSyntacticAnalysis(files: TokenizedFile[]): {
    similarity: number;
    sharedFingerprints: number;
    longestFragment: number;
    coverage1: number;
    coverage2: number;
  } {
    // Create fingerprint index using Dolos algorithm
    const index = new FingerprintIndex(this.kgramSize, this.windowSize, true);
    
    // Add files to index
    index.addFiles(files);
    
    // Get pair analysis
    const pair = index.getPair(files[0], files[1]);
    
    return {
      similarity: pair.similarity,
      sharedFingerprints: pair.overlap,
      longestFragment: pair.longest,
      coverage1: pair.leftCovered / Math.max(1, pair.leftTotal),
      coverage2: pair.rightCovered / Math.max(1, pair.rightTotal)
    };
  }

  /*
  private async performSemanticAnalysis(
    file1: TokenizedFile,
    file2: TokenizedFile
  ): Promise<SemanticSimilarity> {
    // Extract semantic features
    const features1 = this.semanticAnalyzer.extractSemanticFeatures(file1);
    const features2 = this.semanticAnalyzer.extractSemanticFeatures(file2);
    
    // Compare features
    return this.semanticAnalyzer.compareSemanticFeatures(
      features1,
      features2,
      file1.content,
      file2.content
    );
  }
  */

  private calculateAdaptiveThreshold(syntactic: number): number {
    // Base threshold
    let threshold = 0.3;
    
    // Adjust based on similarity levels - now only using syntactic
    const avgSimilarity = syntactic; // (syntactic ) / 2;
    
    if (avgSimilarity > 0.8) {
      threshold = 0.7; // High similarity -> high threshold
    } else if (avgSimilarity > 0.6) {
      threshold = 0.5; // Medium similarity -> medium threshold
    } else if (avgSimilarity > 0.4) {
      threshold = 0.35; // Low-medium similarity -> low-medium threshold
    }
    
    return threshold;
  }

  private calculateBatchThreshold(results: PlagiarismResult[]): number {
    if (results.length === 0) return 0.3;
    
    const similarities = results.map(r => r.overallSimilarity).sort((a, b) => b - a);
    const mean = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - mean, 2), 0) / similarities.length;
    const stdDev = Math.sqrt(variance);
    
    // Use statistical approach: mean + 1.5 * standard deviation
    let threshold = Math.max(0.25, mean + 1.5 * stdDev);
    threshold = Math.min(threshold, 0.8); // Cap at 80%
    
    return threshold;
  }

  private determineConfidence(
    overallSimilarity: number,
    syntactic: any
    // semantic: SemanticSimilarity
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    
    // Factors that increase confidence
    let confidenceScore = 0;
    
    // Overall similarity weight
    if (overallSimilarity > 0.8) confidenceScore += 4;
    else if (overallSimilarity > 0.6) confidenceScore += 3;
    else if (overallSimilarity > 0.4) confidenceScore += 2;
    else confidenceScore += 1;
    
    // Syntactic factors
    if (syntactic.similarity > 0.7) confidenceScore += 2;
    if (syntactic.longestFragment > 10) confidenceScore += 1;
    if (syntactic.coverage1 > 0.5 || syntactic.coverage2 > 0.5) confidenceScore += 1;
    
    // Semantic factors - commented out
    //if (semantic.structuralSimilarity > 0.7) confidenceScore += 2;
    //if (semantic.algorithmicSimilarity > 0.7) confidenceScore += 2;
    //if (semantic.details.sharedProcedures.length > 0) confidenceScore += 1;
    //if (semantic.details.sharedFunctions.length > 0) confidenceScore += 1;
    
    // Determine confidence level - adjusted thresholds since semantic is removed
    if (confidenceScore >= 7) return 'VERY_HIGH'; // was 10
    if (confidenceScore >= 5) return 'HIGH';      // was 7
    if (confidenceScore >= 3) return 'MEDIUM';    // was 4
    return 'LOW';
  }

  /**
   * Generate detailed analysis report
   */
  public static generateReport(result: PlagiarismResult): string {
    let report = `\n🎯 PASCAL PLAGIARISM ANALYSIS REPORT\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    report += `📁 Files Analyzed:\n`;
    report += `   • ${result.file1}\n`;
    report += `   • ${result.file2}\n\n`;
    
    report += `📊 Similarity Metrics:\n`;
    report += `   • Syntactic Similarity: ${(result.syntacticSimilarity * 100).toFixed(1)}%\n`;
   // report += `   • Semantic Similarity: ${(result.semanticSimilarity * 100).toFixed(1)}%\n`;
    report += `   • Overall Similarity: ${(result.overallSimilarity * 100).toFixed(1)}%\n\n`;
    
    report += `🔍 Syntactic Analysis:\n`;
    report += `   • Shared Fragments: ${result.sharedFragments}\n`;
    report += `   • Longest Fragment: ${result.longestFragment} tokens\n`;
    report += `   • Coverage File 1: ${(result.coverage1 * 100).toFixed(1)}%\n`;
    report += `   • Coverage File 2: ${(result.coverage2 * 100).toFixed(1)}%\n\n`;
    
    /*
    report += `🧠 Semantic Analysis:\n`;
    report += `   • Structural Similarity: ${(result.semanticDetails.structuralSimilarity * 100).toFixed(1)}%\n`;
    report += `   • Algorithmic Similarity: ${(result.semanticDetails.algorithmicSimilarity * 100).toFixed(1)}%\n`;
    report += `   • Style Similarity: ${(result.semanticDetails.styleSimilarity * 100).toFixed(1)}%\n`;
    
    if (result.semanticDetails.details.sharedProcedures.length > 0) {
      report += `   • Shared Procedures: ${result.semanticDetails.details.sharedProcedures.join(', ')}\n`;
    }
    
    if (result.semanticDetails.details.sharedFunctions.length > 0) {
      report += `   • Shared Functions: ${result.semanticDetails.details.sharedFunctions.join(', ')}\n`;
    }
    
    if (result.semanticDetails.details.differenceReasons.length > 0) {
      report += `\n⚠️  Key Differences:\n`;
      result.semanticDetails.details.differenceReasons.forEach(reason => {
        report += `   • ${reason}\n`;
      });
    }
    */
    
    report += `\n⚖️  Final Assessment:\n`;
    report += `   • Plagiarism Detected: ${result.isPlagiarism ? '🚨 YES' : '✅ NO'}\n`;
    report += `   • Confidence Level: ${result.confidence}\n`;
    report += `   • Processing Time: ${result.processingTime.toFixed(2)}ms\n\n`;
    
    if (result.isPlagiarism) {
      report += `🚨 PLAGIARISM ALERT: These files show significant similarity!\n`;
      report += `   Recommended action: Manual review required.\n\n`;
    } else {
      report += `✅ No significant plagiarism detected.\n\n`;
    }
    
    return report;
  }

  /**
   * Get configuration information
   */
  public getConfig(): any {
    return {
      kgramSize: this.kgramSize,
      windowSize: this.windowSize,
      // semanticWeight: this.semanticWeight,
      syntacticWeight: this.syntacticWeight,
      version: '2.0.0',
      algorithm: 'Dolos-inspired syntactic analysis only' // Updated description
    };
  }
}