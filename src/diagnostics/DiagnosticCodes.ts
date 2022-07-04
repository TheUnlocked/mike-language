import { DiagnosticInfo, Severity } from './Diagnostics';

export enum DiagnosticCodes {
    // 2000: Parsing
    GenericLexError = 2000,
    GenericParseError = 2001,
    UnexpectedTrailingInput = 2002,
    AssignToExpression = 2003,
    LetIsEmpty = 2003,
    MixedAndOr = 2004,

    // 3000: Definitions
    TypeDefinedMultipleTimes = 3000,

    // 4000: Types
    Uninvokable = 4000,
    WrongNumberOfArguments = 4001,
    ArgumentParameterTypeMismatch = 4002,
    BadArithmeticOpArgumentType = 4003,
    BadInequalityOpArgumentType = 4004,
    BadLogicalOpArgumentType = 4005,
    DereferenceLiteral = 4006,
    InvalidMember = 4007,
    UnknownIdentifier = 4008,
    NoCommonType = 4009,
    TargetTypeMismatch = 4010,
    CannotInferLiteralType = 4011,
    CannotInferEmptyLiteralType = 4012,
    EqualityArgumentTypeMismatch = 4013,
    EqualityArgumentIsLiteral = 4014,
    CannotInferIntermediateLiteralType = 4015,
}

export const defaultDiagnosticDetails: { [name in DiagnosticCodes]: DiagnosticInfo } = {
    [DiagnosticCodes.GenericLexError]: { severity: Severity.Error, description: 'Generic Lexer error: {0}.' },
    [DiagnosticCodes.GenericParseError]: { severity: Severity.Error, description: 'Generic Parser error: {0}.' },
    [DiagnosticCodes.UnexpectedTrailingInput]: { severity: Severity.Error, description: 'Unexpected input.' },
    [DiagnosticCodes.AssignToExpression]: { severity: Severity.Error, description: 'Cannot understand assignment, did you intend the left side to be a field dereference?' },
    [DiagnosticCodes.LetIsEmpty]: { severity: Severity.Error, description: 'A let statement must have a type, or a value from which its type can be inferred.' },
    [DiagnosticCodes.MixedAndOr]: { severity: Severity.Error, description: '&& and || have the same precedence, so order of operations must be explicitly declared using parentheses.' },
    [DiagnosticCodes.TypeDefinedMultipleTimes]: { severity: Severity.Error, description: 'Type {0} is defined multiple times' },
    [DiagnosticCodes.Uninvokable]: { severity: Severity.Error, description: 'Expected a function type, found {0}.' },
    [DiagnosticCodes.WrongNumberOfArguments]: { severity: Severity.Error, description: 'Wrong number of arguments: expected {0}, found {1}.' },
    [DiagnosticCodes.ArgumentParameterTypeMismatch]: { severity: Severity.Error, description: 'Cannot fit argument of type {0} into parameter of type {1}.' },
    [DiagnosticCodes.BadArithmeticOpArgumentType]: { severity: Severity.Error, description: 'Arithmetic operators can only take int or float, instead found {0}.' },
    [DiagnosticCodes.BadInequalityOpArgumentType]: { severity: Severity.Error, description: 'Inequality operators can only take int or float, instead found {0}.' },
    [DiagnosticCodes.BadLogicalOpArgumentType]: { severity: Severity.Error, description: 'Logical operators can only take booleans, instead found {0}.' },
    [DiagnosticCodes.DereferenceLiteral]: { severity: Severity.Error, description: 'Sequence and map literals cannot be dereferenced.' },
    [DiagnosticCodes.InvalidMember]: { severity: Severity.Error, description: 'Type {0} does not have a member {1}.' },
    [DiagnosticCodes.UnknownIdentifier]: { severity: Severity.Error, description: 'Unknown identifier {0}.' },
    [DiagnosticCodes.NoCommonType]: { severity: Severity.Error, description: 'Type {0} did not match previous best common type {1}.' },
    [DiagnosticCodes.TargetTypeMismatch]: { severity: Severity.Error, description: 'Wanted type {0}, but found expression of type {1}.' },
    [DiagnosticCodes.CannotInferLiteralType]: { severity: Severity.Error, description: 'Cannot infer type, is there an unannotated or empty sequence/map literal?' },
    [DiagnosticCodes.CannotInferEmptyLiteralType]: { severity: Severity.Error, description: 'Cannot infer the type of an empty sequence or map literal.' },
    [DiagnosticCodes.EqualityArgumentTypeMismatch]: {
        severity: Severity.Warning,
        description: 'A value of type {0} can never equal a value of type {1}.',
        specializedMessages: [{
            when: (t1, t2) => ['int', 'float'].includes(t1) && ['int', 'float'].includes(t2),
            message: 'Because equality checks between ints and floats are often associated with programming errors, they are disallowed. Use an explicit conversion if you know what you are doing.',
        }]
    },
    [DiagnosticCodes.EqualityArgumentIsLiteral]: { severity: Severity.Warning, description: 'Equality with a new object will always produce false, since equality is by reference.' },
    [DiagnosticCodes.CannotInferIntermediateLiteralType]: { severity: Severity.Error, description: 'Impossible to determine type from provided information, but even intermediate expressions must have an exact type.' },
};
