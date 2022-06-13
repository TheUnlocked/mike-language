grammar MiKe;

program: (paramDecl | stateDecl | eventDecl)*;

paramDecl: PARAM varDef SEMI;

stateDecl: PARAM varDef SEMI;

eventDecl: ON NAME paramList block;

type: NAME typeArguments?;

typeArguments: LANGLE (type (COMMA type)*)? RANGLE;

paramList: LPAREN (varDef (COMMA varDef)*)? RPAREN;

argumentList: LPAREN (expression (COMMA expression)*)? RPAREN;

block: LBRACE statement* RBRACE;

statement
    : expression SEMI                               #expressionStatement
    | LET varDef SEMI                               #letStatement
    | NAME EQUALS expression SEMI                   #assignmentStatement
    | ifStatement                                   #ifStatement_
    | DEBUG expression (COMMA expression)* SEMI     #debugStatement
    ;

ifStatement: IF expression (PIPE NAME PIPE)? block (ELSE ifStatement | ELSE block)?;

varDef: NAME (COLON type)? (EQUALS expression)?;

expression: addsubPrec;

addsubPrec
    : left=muldivPrec (PLUS | MINUS) right=addsubPrec #addsub
    | muldivPrec #addsubFallthrough
    ;

muldivPrec
    : left=invoke (STAR | SLASH) right=muldivPrec #muldiv
    | invoke #muldivFallthrough
    ;

invoke: derefPrec argumentList?;

derefPrec
    : derefPrec DOT NAME #deref
    | atom #derefFallthrough
    ;

atom
    : LPAREN expression RPAREN  #wrappedExpr
    | NAME                      #variableRef
    | (PLUS | MINUS)? FLOAT     #floatLiteral
    | (PLUS | MINUS)? INT       #intLiteral
    | TRUE                      #trueLiteral
    | FALSE                     #falseLiteral
    | seqLiteral                #seqLiteral_
    | mapLiteral                #mapLiteral_
    | STRING                    #stringLiteral
    ;

seqLiteral: NAME? LSQUARE (expression COMMA)* (expression COMMA?)? RSQUARE;
mapLiteral: NAME? LBRACE (mapLiteralPair COMMA)* (mapLiteralPair COMMA?)? RBRACE;

mapLiteralPair: key=expression COLON value=expression;

STRING
    : '\'' (~['\\] | '\\\'' | '\\\\')*? '\''
    | '"' (~["\\] | '\\"' | '\\\\')*? '"'
    ;

PARAM: 'param';
ON: 'on';
LET: 'let';
DEBUG: 'debug';
IF: 'if';
ELSE: 'else';
TRUE: 'true';
FALSE: 'false';

fragment LETTER: [\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}_];
fragment LETTER_OR_NUMBER: LETTER | [\p{Nl}];

NAME: LETTER LETTER_OR_NUMBER*;
FLOAT
    : [0-9]+  '.' [0-9]*                                        // 1. 1.2
    | [0-9]+ ('.' [0-9]*)? ('e' | 'E') ('+' | '-')? [0-9]+      // 1e2 1.3e-4
    |         '.' [0-9]+  (('e' | 'E') ('+' | '-')? [0-9]+)?    // .1 .03e+1
    ;
INT: [0-9]+;

COLON: ':';
EQUALS: '=';
SEMI: ';';
COMMA: ',';
DOT: '.';
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

WS: [ \r\n] -> skip;
