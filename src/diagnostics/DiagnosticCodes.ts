import { suggestType } from '../utils/types';
import { DiagnosticInfo, Severity } from './Diagnostics';

export enum DiagnosticCodes {
    // 2000: Parsing
    GenericLexError = 2000,
    GenericParseError,
    UnexpectedTrailingInput,
    AssignToExpression,
    LetIsEmpty,
    MixedAndOr,

    // 3000: Definitions
    TypeDefinedMultipleTimes = 3000,

    // 4000: Types
    Uninvokable = 4000,
    WrongNumberOfArguments,
    ArgumentParameterTypeMismatch,
    BadArithmeticOpArgumentType,
    BadInequalityOpArgumentType,
    BadLogicalOpArgumentType,
    DereferenceLiteral,
    InvalidMember,
    UnknownIdentifier,
    NoCommonType,
    TypeDoesNotExist,
    TypeIsNotSequenceLike,
    TypeIsNotMapLike,
    PresumedTypeIsNotSequenceLike,
    PresumedTypeIsNotMapLike,
    CannotInferSequenceLiteralType,
    CannotInferMapLiteralType,
    EqualityArgumentIsNewObject,
    EqualityArgumentTypeMismatch,
}

export const defaultDiagnosticDetails = suggestType<{ readonly [name in DiagnosticCodes]: DiagnosticInfo }>()({
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
    [DiagnosticCodes.TypeDoesNotExist]: { severity: Severity.Error, description: 'There is no type named {0} in the current context.' },
    [DiagnosticCodes.TypeIsNotSequenceLike]: { severity: Severity.Error, description: 'Type {0} cannot be used with sequence literals.' },
    [DiagnosticCodes.TypeIsNotMapLike]: { severity: Severity.Error, description: 'Type {0} cannot be used with map literals.' },
    [DiagnosticCodes.PresumedTypeIsNotSequenceLike]: { severity: Severity.Error, description: 'Based on context it seems like this literal is intended to be of type {0}, but {1} cannot be used with sequence literals.' },
    [DiagnosticCodes.PresumedTypeIsNotMapLike]: { severity: Severity.Error, description: 'Based on context it seems like this literal is intended to be of type {0}, but {1} cannot be used with map literals.' },
    [DiagnosticCodes.CannotInferSequenceLiteralType]: { severity: Severity.Error, description: 'Not enough information to determine the type of this sequence literal.' },
    [DiagnosticCodes.CannotInferMapLiteralType]: { severity: Severity.Error, description: 'Not enough information to determine the type of this map literal.' },
    [DiagnosticCodes.EqualityArgumentIsNewObject]: { severity: Severity.Warning, description: 'Equality with a new object will always produce false, since equality is by reference.' },
    [DiagnosticCodes.EqualityArgumentTypeMismatch]: {
        severity: Severity.Warning,
        description: 'A value of type {0} can never equal a value of type {1}.',
        specializedMessages: [{
            when: (t1, t2) => ['int', 'float'].includes(t1) && ['int', 'float'].includes(t2),
            message: 'Because equality checks between ints and floats are often associated with programming errors, they are disallowed. Use an explicit conversion if you know what you are doing.',
        }]
    },
} as const);
