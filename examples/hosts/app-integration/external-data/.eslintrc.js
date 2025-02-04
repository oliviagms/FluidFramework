/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

module.exports = {
    extends: [
        require.resolve("@fluidframework/eslint-config-fluid/strict"),
        "prettier",
    ],
    rules: {
        // TODO: remove once dependency on base config has been updated.
        "@typescript-eslint/explicit-member-accessibility": [
            "error",
            {
                accessibility: "explicit",
                overrides: {
                    accessors: "explicit",
                    constructors: "explicit",
                    methods: "explicit",
                    properties: "explicit",
                    parameterProperties: "explicit",
                },
            },
        ],
    },
};
