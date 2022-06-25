import { DiagnosticInfo, Severity } from './Diagnostics';

export enum DiagnosticCodes {
    // 2000: Parsing
    GenericLexError = 2000,
    GenericParseError = 2001,
    UnexpectedTrailingInput = 2002,

    // 3000: Definitions
    TypeDefinedMultipleTimes = 3000,

    // 4000: Types
    Uninvokable = 4000,
    WrongNumberOfArguments = 4001,
    ArgumentParameterTypeMismatch = 4002,
    BadBinaryTypeArgumentType = 4003,
    DereferenceLiteral = 4004,
    InvalidMember = 4005,
    UnknownIdentifier = 4006,
    NoCommonType = 4007,
    TargetTypeMismatch = 4008,
    CannotInferLiteralType = 4009,
    CannotInferEmptyLiteralType = 4010,
}

export const diagnosticsList: { [name in DiagnosticCodes]: DiagnosticInfo } = {
    [DiagnosticCodes.GenericLexError]: { severity: Severity.Error, description: 'Lexer error: {0}' },
    [DiagnosticCodes.GenericParseError]: { severity: Severity.Error, description: 'Parser error: {0}' },
    [DiagnosticCodes.UnexpectedTrailingInput]: { severity: Severity.Error, description: 'Unexpected input' },
    [DiagnosticCodes.TypeDefinedMultipleTimes]: { severity: Severity.Error, description: 'Type {0} is defined multiple times' },
    [DiagnosticCodes.Uninvokable]: { severity: Severity.Error, description: 'Expected a function type, found {0}' },
    [DiagnosticCodes.WrongNumberOfArguments]: { severity: Severity.Error, description: 'Wrong number of arguments: expected {0}, found {1}' },
    [DiagnosticCodes.ArgumentParameterTypeMismatch]: { severity: Severity.Error, description: 'Cannot fit argument of type {0} into parameter of type {1}' },
    [DiagnosticCodes.BadBinaryTypeArgumentType]: { severity: Severity.Error, description: 'Arithmetic operators can only take int or float, instead found {0}' },
    [DiagnosticCodes.DereferenceLiteral]: { severity: Severity.Error, description: 'Sequence and map literals cannot be dereferenced' },
    [DiagnosticCodes.InvalidMember]: { severity: Severity.Error, description: 'Type {0} does not have a member {1}' },
    [DiagnosticCodes.UnknownIdentifier]: { severity: Severity.Error, description: 'Unknown identifier {0}' },
    [DiagnosticCodes.NoCommonType]: { severity: Severity.Error, description: 'Type {0} did not match previous best common type {1}' },
    [DiagnosticCodes.TargetTypeMismatch]: { severity: Severity.Error, description: 'Wanted type {0}, but found expression of type {1}' },
    [DiagnosticCodes.CannotInferLiteralType]: { severity: Severity.Error, description: 'Cannot infer type, is there an unannotated or empty sequence/map literal?' },
    [DiagnosticCodes.CannotInferEmptyLiteralType]: { severity: Severity.Error, description: 'Cannot infer the type of an empty sequence or map literal' },
};
