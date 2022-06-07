module.exports = {
    "require": "ts-node/register",
    "extensions": ["js", "ts"],
    "spec": [
        "src/**/tests/**/*.spec.*"
    ],
    "watch-files": [
        "src"
    ]
};