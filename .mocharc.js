module.exports = {
    "require": "ts-node/register",
    "extensions": ["js", "ts"],
    "spec": [
        "tests/*.spec.ts"
    ],
    "watch-files": [
        "src/**",
        "tests/**",
    ],
    "reporter-option": [
        "maxDiffSize=32768"
    ],
};