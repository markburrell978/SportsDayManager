import javascript from '@eslint/js';
import globals from 'globals';
import typescript from 'typescript-eslint';

/** Reject shortened local bindings while preserving third-party property names. */
const descriptiveBindings = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      abbreviated:
        'Use full words for "{{name}}" (for example, identifier, transaction or configuration).',
    },
  },
  create(context) {
    return {
      'Program:exit'() {
        for (const scope of context.sourceCode.scopeManager.scopes) {
          for (const variable of scope.variables) {
            if (!variable.defs.length) {
              continue;
            }
            const name = variable.name;
            if (
              /^[a-z]$/.test(name) ||
              /^(?:id|ids|url|urls|uuid|sql|tx|sp|params|config|html|json|ui|vm|args|opts|num|idx|len|temp|tmp)$/.test(
                name,
              ) ||
              /(?:Id|Ids|Url|Urls)$/.test(name)
            ) {
              context.report({
                node: variable.identifiers[0] || variable.defs[0].node,
                messageId: 'abbreviated',
                data: { name },
              });
            }
          }
        }
      },
    };
  },
};

/** Require a short purpose comment on named functions, rather than every callback. */
const documentedFunctions = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      missing: 'Add a brief purpose comment to this named function.',
    },
  },
  create(context) {
    function check(node) {
      const parent = node.parent;
      let declaration = node;
      if (parent?.type === 'ExportNamedDeclaration') {
        declaration = parent;
      } else if (
        parent?.type === 'Property' ||
        parent?.type === 'MethodDefinition'
      ) {
        declaration = parent;
      } else if (parent?.type === 'VariableDeclarator') {
        declaration = parent.parent;
      } else if (node.type !== 'FunctionDeclaration') {
        return;
      }
      if (!context.sourceCode.getCommentsBefore(declaration).length) {
        context.report({ node: declaration, messageId: 'missing' });
      }
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
};

export default [
  {
    ignores: [
      'node_modules/**',
      'supabase/.temp/**',
      'supabase/.branches/**',
      '**/.env*',
      'backups/**',
      'exports/**',
    ],
  },
  javascript.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts}'],
    plugins: {
      project: {
        rules: {
          'descriptive-bindings': descriptiveBindings,
          'documented-functions': documentedFunctions,
        },
      },
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.es2024,
        ...globals.node,
        ...globals.browser,
        Deno: 'readonly',
      },
    },
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^unused',
          varsIgnorePattern: '^unused',
          caughtErrors: 'none',
        },
      ],
      'project/descriptive-bindings': 'error',
    },
  },
  {
    files: ['web/js/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ApplicationInterface: 'readonly',
        ApplicationState: 'readonly',
        CONFIGURATION: 'readonly',
        EventView: 'readonly',
        applyCompetitorFilters: 'readonly',
        clearCompetitorMessage: 'readonly',
        clearEventMessage: 'readonly',
        closeCompetitorModal: 'readonly',
        completeDistanceEventRun: 'readonly',
        confirmCurrentEventResults: 'readonly',
        currentRunWithConfirmation: 'readonly',
        deactivateCompetitor: 'readonly',
        editCompetitor: 'readonly',
        editPointProfile: 'readonly',
        filterCompetitors: 'readonly',
        generateRoundRobinFixtures: 'readonly',
        generateTournamentFixtures: 'readonly',
        getCompetitorFormData: 'readonly',
        initialise: 'readonly',
        isCompetitorActive: 'readonly',
        loadCompetitors: 'readonly',
        loadCurrentDistance: 'readonly',
        loadCurrentDoubleTeamMatch: 'readonly',
        loadCurrentEventRun: 'readonly',
        loadCurrentMatches: 'readonly',
        loadCurrentPointsProfile: 'readonly',
        loadCurrentRace: 'readonly',
        loadEvents: 'readonly',
        loadLeaderboard: 'readonly',
        loadPointProfiles: 'readonly',
        normaliseTeamColour: 'readonly',
        openCompetitorModal: 'readonly',
        openEventHistory: 'readonly',
        openPendingEvent: 'readonly',
        populateTeamDropdown: 'readonly',
        populateTeamFilter: 'readonly',
        refreshConfirmationStatus: 'readonly',
        refreshDistanceEvent: 'readonly',
        refreshDoubleTeamEvent: 'readonly',
        refreshRaceEvent: 'readonly',
        registerCompetitorEvents: 'readonly',
        registerNavigation: 'readonly',
        renderCompetitors: 'readonly',
        renderConfirmationNotices: 'readonly',
        renderEvents: 'readonly',
        renderLeaderboard: 'readonly',
        renderPointProfiles: 'readonly',
        resetCurrentEvent: 'readonly',
        restoreCompetitor: 'readonly',
        saveCompetitor: 'readonly',
        saveDistanceCategoryPositions: 'readonly',
        saveDoubleTeamPairing: 'readonly',
        saveDoubleTeamWinner: 'readonly',
        saveMatchWinner: 'readonly',
        savePointProfile: 'readonly',
        saveRaceFinalPositions: 'readonly',
        saveRaceHeatWinner: 'readonly',
        selectDistanceCategory: 'readonly',
        selectEvent: 'readonly',
        selectRaceCategory: 'readonly',
        setEventRequestPending: 'readonly',
        showCompetitorMessage: 'readonly',
        showCurrentEventView: 'readonly',
        showEventMessage: 'readonly',
        showPage: 'readonly',
        startNewPointProfile: 'readonly',
        startRaceEvent: 'readonly',
        updateCompetitorStatus: 'readonly',
        updateDoubleTeamPreview: 'readonly',
        updateNavigation: 'readonly',
        updateTournamentPairingOptions: 'readonly',
        validateCompetitor: 'readonly',
        validateDistancePositions: 'readonly',
        validatePointProfile: 'readonly',
        validateRaceFinalPositions: 'readonly',
        validateTournamentPairings: 'readonly',
        Authentication: 'readonly',
        Session: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { vars: 'local', argsIgnorePattern: '^unused' },
      ],
      'project/documented-functions': 'error',
    },
  },
  {
    files: ['apps-script/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        APPLICATION_ACTIONS: 'readonly',
        CONFIGURATION: 'readonly',
        CompetitorService: 'readonly',
        DISTANCE_CATEGORIES: 'readonly',
        Database: 'readonly',
        DistanceService: 'readonly',
        DoubleTeamService: 'readonly',
        EVENT_STATUS: 'readonly',
        EVENT_TYPES: 'readonly',
        EventHistoryService: 'readonly',
        EventRunService: 'readonly',
        EventService: 'readonly',
        LeaderboardService: 'readonly',
        POINT_PROFILE_HEADERS: 'readonly',
        PointProfileService: 'readonly',
        RACE_CATEGORIES: 'readonly',
        RaceService: 'readonly',
        ResultService: 'readonly',
        ServiceUtilities: 'readonly',
        TABLES: 'readonly',
        TOURNAMENT_ROUNDS: 'readonly',
        TeamService: 'readonly',
        doGet: 'readonly',
        doPost: 'readonly',
        getSpreadsheet: 'readonly',
        handleRequest: 'readonly',
        jsonResponse: 'readonly',
        SpreadsheetApp: 'readonly',
        PropertiesService: 'readonly',
        Utilities: 'readonly',
        LockService: 'readonly',
        ContentService: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { vars: 'local', argsIgnorePattern: '^unused' },
      ],
      'project/documented-functions': 'error',
      // Apps Script may run on a V8 version without Error.cause support. The
      // public message already includes the useful cause without leaking data.
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.js'],
    rules: {
      'project/documented-functions': 'error',
      // Generated compatibility services share the Apps Script error shape.
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: typescript.parser },
    rules: { 'project/documented-functions': 'error' },
  },
];
