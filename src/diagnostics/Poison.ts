/**
 * Poison lets us escape processing an expression once we find a fatal error
 * to avoid spitting out a bunch of other confusing errors.
 */
export default class Poison extends Error {

}