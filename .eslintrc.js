/*
Copyright 2019-2022 The Tekton Authors
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
module.exports = {
  parser: '@babel/eslint-parser',
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true
  },
  extends: [
    'airbnb',
    'plugin:prettier/recommended',
    'plugin:cypress/recommended'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  overrides: [
    {
      files: ['*.cy.js'],
      rules: {
        'func-names': 'off'
      }
    }
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  plugins: ['notice', 'react'],
  rules: {
    curly: ['error', 'all'],
    'cypress/assertion-before-screenshot': 'warn',
    'default-param-last': 'off',
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
    'no-case-declarations': 'off',
    'no-restricted-exports': 'off',
    'no-template-curly-in-string': 'off',
    'no-unused-vars': [
      'error',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        vars: 'all'
      }
    ],
    'notice/notice': [
      'error',
      {
        templateFile: 'config_frontend/copyright.txt',
        nonMatchingTolerance: 0.95
      }
    ],
    'react/destructuring-assignment': 'off',
    'react/forbid-prop-types': 'off',
    'react/function-component-definition': 'off',
    'react/no-unstable-nested-components': 'off',
    'react/jsx-curly-newline': 'off',
    'react/jsx-filename-extension': 'off',
    'react/jsx-no-bind': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/prop-types': 'off',
    'react/state-in-constructor': 'off',
    'sort-imports': [
      'error',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true
      }
    ]
  }
};
