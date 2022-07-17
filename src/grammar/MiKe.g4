grammar MiKe;

program: topLevelDecl*;

topLevelDecl
    : paramDecl
    | stateDecl
    | eventDecl
    | typeDef
    ;

paramDecl: PARAM paramDef SEMI;

stateDecl: STATE varDef SEMI;

eventDecl: ON NAME paramList block;

typeDef: TYPE NAME paramList SEMI;

type
    : NAME typeArguments?
    | typeList DOUBLE_ARROW type
    ;

typeArguments: LANGLE (type (COMMA type)*)? RANGLE;

typeList: LPAREN (type (COMMA type)*)? RPAREN;

paramList: LPAREN (paramDef (COMMA paramDef)*)? RPAREN;

argumentList: LPAREN (expression (COMMA expression)*)? RPAREN;

block: LBRACE statement* RBRACE;

statement
    : expression SEMI                            #expressionStatement
    | LET varDef SEMI                            #letStatement
    | NAME EQUALS expression SEMI                #varAssignmentStatement
    | expression EQUALS expression SEMI          #fieldAssignmentStatement
    | ifStatement                                #ifStatement_
    | DEBUG expression (COMMA expression)* SEMI  #debugStatement
    | block                                      #blockStatement_
    ;

ifStatement: IF ifCase (ELSE IF ifCase)* (ELSE block)?;

ifCase: expression (PIPE NAME PIPE)? block;

paramDef: NAME COLON type;

varDef: NAME (COLON type)? (EQUALS expression)?;

expression: logicalPrec;

logicalPrec
    : left=logicalPrec (AND_AND | PIPE_PIPE) right=comparisonPrec #logical
    | comparisonPrec #logicalFallthrough
    ;

comparisonPrec
    : left=addsubPrec
        ( EQUALS_EQUALS | BANG_EQUALS
        | LANGLE | RANGLE
        | LANGLE_EQUALS | RANGLE_EQUALS
        ) right=addsubPrec #comparison
    | addsubPrec #comparisonFallthrough
    ;

addsubPrec
    : left=addsubPrec (PLUS | MINUS) right=muldivPrec #addsub
    | muldivPrec #addsubFallthrough
    ;

muldivPrec
    : left=muldivPrec (STAR | SLASH) right=unaryPrec #muldiv
    | unaryPrec #muldivFallthrough
    ;

unaryPrec
    : (MINUS | BANG) unaryPrec #unary
    | invoke #unaryFallthrough
    ;

invoke: derefPrec argumentList?;

derefPrec
    : derefPrec DOT NAME #deref
    | atom #derefFallthrough
    ;

atom
    : LPAREN expression RPAREN  #wrappedExpr
    | NAME                      #variableRef
    | FLOAT                     #floatLiteral
    | INT                       #intLiteral
    | TRUE                      #trueLiteral
    | FALSE                     #falseLiteral
    | seqLiteral                #seqLiteral_
    | mapLiteral                #mapLiteral_
    | STRING                    #stringLiteral
    ;

seqLiteral: NAME? LSQUARE (expression COMMA)* (expression COMMA?)? RSQUARE;
mapLiteral: NAME? LBRACE (mapLiteralPair COMMA)* (mapLiteralPair COMMA?)? RBRACE;

mapLiteralPair: key=expression COLON value=expression;

comments: COMMENT*;

STRING
    : '\'' (~['\\] | '\\\'' | '\\\\')*? '\''
    | '"' (~["\\] | '\\"' | '\\\\')*? '"'
    ;

COMMENT: '//' .*? '\n' -> channel(2);

PARAM: 'param';
STATE: 'state';
TYPE: 'type';
ON: 'on';
LET: 'let';
DEBUG: 'debug';
IF: 'if';
ELSE: 'else';
TRUE: 'true';
FALSE: 'false';

RESERVED
    : 'function' | 'export' | 'import' | 'new'
    | 'null' | 'undefined' | 'const' | 'var' | 'val'
    ;

fragment LETTER: [\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}_];
fragment LETTER_OR_NUMBER: LETTER | [\p{Nd}];

NAME: LETTER LETTER_OR_NUMBER*;

fragment PLUS_OR_MINUS: [+-];
fragment E: [eE];

FLOAT
    : PLUS_OR_MINUS? [0-9]+  '.' [0-9]*                             // 1. 1.2
    | PLUS_OR_MINUS? [0-9]+ ('.' [0-9]*)? E PLUS_OR_MINUS? [0-9]+   // 1e2 1.3e-4
    | PLUS_OR_MINUS?         '.' [0-9]+  (E PLUS_OR_MINUS? [0-9]+)? // .1 .03e+1
    ;
INT: PLUS_OR_MINUS? [0-9]+;

LANGLE_EQUALS: '<=';
RANGLE_EQUALS: '>=';
EQUALS_EQUALS: '==';
BANG_EQUALS: '!=';

AND_AND: '&&';
PIPE_PIPE: '||';

COLON: ':';
EQUALS: '=';
SEMI: ';';
COMMA: ',';
DOT: '.';
BANG: '!';
STAR: '*';
SLASH: '/';
PLUS: '+';
MINUS: '-';
LANGLE: '<';
RANGLE: '>';
LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
LSQUARE: '[';
RSQUARE: ']';
PIPE: '|';

DOUBLE_ARROW: '=>';

WS: [ \r\n] -> skip;
