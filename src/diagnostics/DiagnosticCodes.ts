import { suggestType } from '../utils/types';
import { DiagnosticInfo, DiagnosticsManager, Severity } from './Diagnostics';

export enum DiagnosticCodes {
    // 2000: Parsing
    GenericLexError = 2000,
    GenericParseError,
    AssignToExpression,
    LetIsEmpty,
    MixedAndOr,
    NoStateInitialValue,
    
    // 3000: Definitions & Flow
    TypeDefinedMultipleTimes = 3000,
    VariableDefinedMultipleTimes,
    TypeNameAlreadyDefinedAsVariable,
    StateNotSerializable,
    InvalidParameterType,
    NotYetDefined,
    NotYetInitialized,

    // 4000: Types
    Uninvokable = 4000,
    WrongNumberOfArguments,
    ArgumentParameterTypeMismatch,
    BadArithmeticOpArgumentType,
    BadInequalityOpArgumentType,
    BadLogicalOpArgumentType,
    EqualityArgumentTypeMismatch,
    EqualityArgumentIsNewObject,
    InvalidMember,
    UnknownIdentifier,
    NoCommonType,
    TypeDoesNotExist,
    WrongNumberOfTypeArguments,
    TypeIsNotSequenceLike,
    TypeIsNotMapLike,
    PresumedTypeIsNotSequenceLike,
    PresumedTypeIsNotMapLike,
    CannotInferSequenceLiteralType,
    CannotInferMapLiteralType,
    AssignmentTypeMismatch,
    CannotAssignToReadonlyVariable,
    CannotAssignToReadonlyField,
    TypeCannotBeUsedAsACondition,
    TypeCannotBeDestructured,
}

export const defaultDiagnosticDetails = suggestType<{ readonly [name in DiagnosticCodes]: DiagnosticInfo }>()({
    [DiagnosticCodes.GenericLexError]: { severity: Severity.Error, description: 'Generic Lexer error: {0}.' },
    [DiagnosticCodes.GenericParseError]: { severity: Severity.Error, description: 'Generic Parser error: {0}.' },
    [DiagnosticCodes.AssignToExpression]: { severity: Severity.Error, description: 'Cannot understand assignment, did you intend the left side to be a field dereference?' },
    [DiagnosticCodes.LetIsEmpty]: { severity: Severity.Error, description: 'A let statement must have a type, or a value from which its type can be inferred.' },
    [DiagnosticCodes.MixedAndOr]: { severity: Severity.Error, description: '&& and || have the same precedence, so order of operations must be explicitly declared using parentheses.' },
    [DiagnosticCodes.NoStateInitialValue]: { severity: Severity.Error, description: 'State declarations must have initial values.' },
    [DiagnosticCodes.TypeDefinedMultipleTimes]: { severity: Severity.Error, description: 'Type {0} was already defined.' },
    [DiagnosticCodes.VariableDefinedMultipleTimes]: { severity: Severity.Error, description: 'Variable {0} was already defined in this scope.' },
    [DiagnosticCodes.TypeNameAlreadyDefinedAsVariable]: { severity: Severity.Error, description: 'Type {0} cannot be defined because a variable with that name already exists.' },
    [DiagnosticCodes.StateNotSerializable]: { severity: Severity.Error, description: 'State variables must be serializable, but type {0} is not serializable.' },
    [DiagnosticCodes.InvalidParameterType]: { severity: Severity.Error, description: 'Type {0} is not a valid parameter type. Only readonly types and primitives can be used in parameters.' },
    [DiagnosticCodes.NotYetDefined]: { severity: Severity.Error, description: 'Variable {0} is used before it is defined.' },
    [DiagnosticCodes.NotYetInitialized]: { severity: Severity.Error, description: 'Variable {0} is not definitely assigned here.' },
    [DiagnosticCodes.Uninvokable]: { severity: Severity.Error, description: 'Expected a function type, found {0}.' },
    [DiagnosticCodes.WrongNumberOfArguments]: { severity: Severity.Error, description: 'Wrong number of arguments: expected {0}, found {1}.' },
    [DiagnosticCodes.ArgumentParameterTypeMismatch]: { severity: Severity.Error, description: 'Cannot fit argument of type {0} into parameter of type {1}.' },
    [DiagnosticCodes.BadArithmeticOpArgumentType]: { severity: Severity.Error, description: 'Arithmetic operators can only take int or float, instead found {0}.', specializedMessages: [
        { when: t => ['int', 'float'].includes(t), message: 'The types of the arguments to an arithmetic operator must match. Use a toInt or toFloat conversion.' },
    ] },
    [DiagnosticCodes.BadInequalityOpArgumentType]: { severity: Severity.Error, description: 'Inequality operators can only take int or float, instead found {0}.' },
    [DiagnosticCodes.BadLogicalOpArgumentType]: { severity: Severity.Error, description: 'Logical operators can only take booleans, instead found {0}.' },
    [DiagnosticCodes.InvalidMember]: { severity: Severity.Error, description: 'Type {0} does not have a member {1}.' },
    [DiagnosticCodes.UnknownIdentifier]: { severity: Severity.Error, description: 'Unknown identifier {0}.' },
    [DiagnosticCodes.NoCommonType]: { severity: Severity.Error, description: 'Type {0} did not match previous best common type {1}.' },
    [DiagnosticCodes.TypeDoesNotExist]: { severity: Severity.Error, description: 'There is no type named {0} in the current context.' },
    [DiagnosticCodes.WrongNumberOfTypeArguments]: { severity: Severity.Error, description: 'Wrong number of type arguments: expected {0}, found {1}.' },
    [DiagnosticCodes.TypeIsNotSequenceLike]: { severity: Severity.Error, description: 'Type {0} cannot be used with sequence literals.' },
    [DiagnosticCodes.TypeIsNotMapLike]: { severity: Severity.Error, description: 'Type {0} cannot be used with map literals.' },
    [DiagnosticCodes.PresumedTypeIsNotSequenceLike]: { severity: Severity.Error, description: 'Based on context it seems like this literal is intended to be of type {0}, but {1} cannot be used with sequence literals.' },
    [DiagnosticCodes.PresumedTypeIsNotMapLike]: { severity: Severity.Error, description: 'Based on context it seems like this literal is intended to be of type {0}, but {1} cannot be used with map literals.' },
    [DiagnosticCodes.CannotInferSequenceLiteralType]: { severity: Severity.Error, description: 'Not enough information to determine the type of this sequence literal.' },
    [DiagnosticCodes.CannotInferMapLiteralType]: { severity: Severity.Error, description: 'Not enough information to determine the type of this map literal.' },
    [DiagnosticCodes.EqualityArgumentIsNewObject]: { severity: Severity.Warning, description: 'Equality with a new object will always produce false, since equality is by reference.' },
    [DiagnosticCodes.EqualityArgumentTypeMismatch]: { severity: Severity.Warning, description: 'A value of type {0} can never equal a value of type {1}.' },
    [DiagnosticCodes.AssignmentTypeMismatch]: { severity: Severity.Error, description: 'Cannot assign a value of type {0} to a variable of type {1}.' },
    [DiagnosticCodes.CannotAssignToReadonlyVariable]: { severity: Severity.Error, description: 'Cannot assign to readonly variable {0}.' },
    [DiagnosticCodes.CannotAssignToReadonlyField]: { severity: Severity.Error, description: 'Cannot assign to readonly field {0} on type {1}.' },
    [DiagnosticCodes.TypeCannotBeUsedAsACondition]: { severity: Severity.Error, description: 'Cannot use type {0} as a condition in an if statement.' },
    [DiagnosticCodes.TypeCannotBeDestructured]: { severity: Severity.Error, description: 'Cannot destructure type {0} in an if statement.' },
} as const);

export function createMiKeDiagnosticsManager() {
    const diagnostics = new DiagnosticsManager();
    Object.entries(defaultDiagnosticDetails as { [name: number]: DiagnosticInfo })
        .map(([idStr, { severity, description, specializedMessages }]) => {
            diagnostics.registerDiagnostic('mike', +idStr, severity, description);
            for (const details of specializedMessages ?? []) {
                diagnostics.registerDiagnosticMessage('mike', +idStr, details.when, details.message);
            }
        });
    
    return diagnostics;
}
