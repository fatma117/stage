import { PascalParser } from './parser';
import { PascalNormalizer, DolosTokenResult } from './normalizer';
import { Region } from '../util/region.ts';
import { File } from '../file/file.ts';
import { TokenizedFile } from '../file/tokenizedFile.ts';
import Parser from 'tree-sitter';

export class PascalTokenizer {
  private pascalParser: PascalParser;
  private normalizer: PascalNormalizer;
  
  constructor() {
    this.pascalParser = new PascalParser();
    this.normalizer = new PascalNormalizer();
  }
  
  /**
   * Main method: Takes a Pascal file and returns normalized tokens
   */
  tokenizeFile(filePath: string, sourceCode: string): TokenizedFile {
    // Step 1: Parse Pascal code into AST
    const tree = this.pascalParser.parse(sourceCode);
    
    // Step 2: Convert Tree-sitter format to your normalizer's format
    const rootNode = this.convertTreeSitterNode(tree.rootNode);
    
    // Step 3: Normalize tokens using your PascalNormalizer
    const result: DolosTokenResult = this.normalizer.normalize(rootNode);
    
    // Step 4: Create TokenizedFile
    const file = new File(filePath, sourceCode);
    return new TokenizedFile(file, result.tokens, result.mapping);
  }
  
  /**
   * Convert Tree-sitter node to your normalizer's expected format
   */
  private convertTreeSitterNode(node: Parser.SyntaxNode): any {
    return {
      type: node.type,
      text: node.text,
      startPosition: {
        row: node.startPosition.row,
        column: node.startPosition.column
      },
      endPosition: {
        row: node.endPosition.row,
        column: node.endPosition.column
      },
      children: node.children?.map(child => this.convertTreeSitterNode(child)) || [],
      namedChildren: node.namedChildren?.map(child => this.convertTreeSitterNode(child)) || []
    };
  }
  
  /**
   * Quick test method to see raw AST structure
   */
  debugParseTree(sourceCode: string): void {
    const tree = this.pascalParser.parse(sourceCode);
    console.log('AST Root:', tree.rootNode.toString());
    this.printNode(tree.rootNode, 0);
  }
  
  private printNode(node: Parser.SyntaxNode, depth: number): void {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${node.type}: "${node.text.substring(0, 50)}"`);
    
    for (const child of node.children) {
      this.printNode(child, depth + 1);
    }
  }
}