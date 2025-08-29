import { PascalTokenizer } from '../core/tokenizer/tokenizer';

// Sample Pascal code
const pascalCode = `
program UniversitySystem;

type
  Student = record
    ID: integer;
    Name: string;
    Grades: array[1..5] of real;
  end;

var
  Students: array[1..100] of Student;
  i, j, numStudents: integer;
  average: real;

procedure InputStudent(var S: Student);
var
  k: integer;
begin
  write('Enter ID: '); readln(S.ID);
  write('Enter Name: '); readln(S.Name);
  for k := 1 to 5 do
  begin
    write('Grade ', k, ': ');
    readln(S.Grades[k]);
  end;
end;

function CalculateAverage(S: Student): real;
var
  sum: real;
  k: integer;
begin
  sum := 0;
  for k := 1 to 5 do
    sum := sum + S.Grades[k];
  CalculateAverage := sum / 5;
end;

procedure DisplayStudent(S: Student);
var
  k: integer;
begin
  writeln('Student ID: ', S.ID);
  writeln('Name: ', S.Name);
  writeln('Grades: ');
  for k := 1 to 5 do
    writeln('  Grade ', k, ': ', S.Grades[k]:0:2);
  writeln('Average: ', CalculateAverage(S):0:2);
end;

begin
  writeln('=== University Student Management ===');
  write('Enter number of students: ');
  readln(numStudents);
  if numStudents > 100 then
  begin
    writeln('Too many students. Max is 100.');
    halt;
  end;

  for i := 1 to numStudents do
  begin
    writeln;
    writeln('Entering data for student ', i);
    InputStudent(Students[i]);
  end;

  writeln;
  writeln('=== Student Report ===');
  for i := 1 to numStudents do
  begin
    writeln;
    DisplayStudent(Students[i]);
  end;

  writeln;
  writeln('=== Summary ===');
  for i := 1 to numStudents do
  begin
    average := CalculateAverage(Students[i]);
    if average >= 10 then
      writeln(Students[i].Name, ' passed.')
    else
      writeln(Students[i].Name, ' failed.');
  end;

  writeln('=== Program Complete ===');
end.
`;

// Create tokenizer and process
const tokenizer = new PascalTokenizer();

try {
  // Get normalized tokens
  const result = tokenizer.tokenizeFile('test.pas', pascalCode);
  
  console.log('Tokens:', result.tokens);
  console.log('Number of tokens:', result.tokens.length);
  
  // Debug: see the raw AST structure
  tokenizer.debugParseTree(pascalCode);
  
} catch (error) {
  console.error('Error:', error);
}