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
/* istanbul ignore file */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';
import keyBy from 'lodash.keyby';
import yaml from 'js-yaml';
import {
  Button,
  Form,
  FormGroup,
  InlineNotification,
  TextInput,
  Toggle
} from 'carbon-components-react';
import {
  ALL_NAMESPACES,
  generateId,
  resourceNameRegex,
  urls,
  useTitleSync
} from '@tektoncd/dashboard-utils';
import { KeyValueList } from '@tektoncd/dashboard-components';
import { useIntl } from 'react-intl';
import {
  NamespacesDropdown,
  PipelineResourcesDropdown,
  PipelinesDropdown,
  ServiceAccountsDropdown
} from '..';
import {
  createPipelineRun,
  getPipelineRunPayload,
  usePipeline,
  useSelectedNamespace
} from '../../api';
import { isValidLabel } from '../../utils';
import { CreateYAMLEditor } from './YAMLEditor';

const initialState = {
  creating: false,
  invalidLabels: {},
  invalidNodeSelector: {},
  labels: [],
  namespace: '',
  nodeSelector: [],
  params: {},
  paramSpecs: [],
  pendingPipelineStatus: '',
  pipelineError: false,
  pipelineRef: '',
  pipelineRunName: '',
  resources: {},
  resourceSpecs: [],
  serviceAccount: '',
  submitError: '',
  timeoutsFinally: '',
  timeoutsPipeline: '',
  timeoutsTasks: '',
  validationError: false,
  validPipelineRunName: true
};

const initialParamsState = paramSpecs => {
  if (!paramSpecs) {
    return {};
  }
  const paramsReducer = (acc, param) => ({
    ...acc,
    [param.name]: param.default || ''
  });
  return paramSpecs.reduce(paramsReducer, {});
};

const initialResourcesState = resourceSpecs => {
  if (!resourceSpecs) {
    return {};
  }
  const resourcesReducer = (acc, resource) => ({
    ...acc,
    [resource.name]: ''
  });
  return resourceSpecs.reduce(resourcesReducer, {});
};

function CreatePipelineRun() {
  const intl = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedNamespace: defaultNamespace } = useSelectedNamespace();

  function getPipelineName() {
    const urlSearchParams = new URLSearchParams(location.search);
    return urlSearchParams.get('pipelineName') || '';
  }

  function getNamespace() {
    const urlSearchParams = new URLSearchParams(location.search);
    return (
      urlSearchParams.get('namespace') ||
      (defaultNamespace !== ALL_NAMESPACES ? defaultNamespace : '')
    );
  }

  function isYAMLMode() {
    const urlSearchParams = new URLSearchParams(location.search);
    return urlSearchParams.get('mode') === 'yaml';
  }

  const [
    {
      creating,
      invalidLabels,
      invalidNodeSelector,
      labels,
      namespace,
      nodeSelector,
      params,
      pipelinePendingStatus,
      pipelineRef,
      pipelineRunName,
      resources,
      serviceAccount,
      submitError,
      timeoutsFinally,
      timeoutsPipeline,
      timeoutsTasks,
      validationError,
      validPipelineRunName
    },
    setState
  ] = useState({
    ...initialState,
    namespace: getNamespace(),
    pipelineRef: getPipelineName(),
    params: initialParamsState(null),
    resources: initialResourcesState(null)
  });

  const { data: pipeline, error: pipelineError } = usePipeline(
    { name: pipelineRef, namespace },
    { enabled: !!pipelineRef }
  );

  let paramSpecs;
  let resourceSpecs;
  if (pipeline?.spec) {
    ({ resources: resourceSpecs, params: paramSpecs } = pipeline.spec);
  }

  useTitleSync({
    page: intl.formatMessage({
      id: 'dashboard.createPipelineRun.title',
      defaultMessage: 'Create PipelineRun'
    })
  });

  const checked = isPending => {
    setState(state => ({
      ...state,
      pipelinePendingStatus: isPending ? 'PipelineRunPending' : ''
    }));
  };

  function switchToYamlMode() {
    const queryParams = new URLSearchParams(location.search);
    queryParams.set('mode', 'yaml');
    const browserURL = location.pathname.concat(`?${queryParams.toString()}`);
    navigate(browserURL);
  }

  function checkFormValidation() {
    // Namespace, PipelineRef, Resources, and Params must all have values
    const validNamespace = !!namespace;
    const validPipelineRef = !!pipelineRef;
    const validResources =
      !resources ||
      Object.keys(resources).reduce(
        (acc, name) => acc && !!resources[name],
        true
      );
    const paramSpecMap = keyBy(paramSpecs, 'name');
    const validParams =
      !params ||
      Object.keys(params).reduce(
        (acc, name) =>
          acc &&
          (!!params[name] ||
            typeof paramSpecMap[name]?.default !== 'undefined'),
        true
      );

    // PipelineRun name
    const pipelineRunNameTest =
      !pipelineRunName ||
      (resourceNameRegex.test(pipelineRunName) && pipelineRunName.length < 64);
    setState(state => ({
      ...state,
      validPipelineRunName: pipelineRunNameTest
    }));

    // Labels
    let validLabels = true;
    labels.forEach(label => {
      ['key', 'value'].forEach(type => {
        if (!isValidLabel(type, label[type])) {
          validLabels = false;
          setState(prevState => ({
            ...prevState,
            invalidLabels: {
              ...prevState.invalidLabels,
              [`${label.id}-${type}`]: true
            }
          }));
        }
      });
    });

    // Node selector
    let validNodeSelector = true;
    nodeSelector.forEach(label => {
      ['key', 'value'].forEach(type => {
        if (!isValidLabel(type, label[type])) {
          validNodeSelector = false;
          setState(prevState => ({
            ...prevState,
            invalidNodeSelector: {
              ...prevState.invalidNodeSelector,
              [`${label.id}-${type}`]: true
            }
          }));
        }
      });
    });

    return (
      validNamespace &&
      validPipelineRef &&
      validResources &&
      validParams &&
      validLabels &&
      validNodeSelector &&
      pipelineRunNameTest
    );
  }

  function isDisabled() {
    if (namespace === '') {
      return true;
    }
    return false;
  }

  function resetError() {
    setState(state => ({ ...state, submitError: '' }));
  }

  function handleClose() {
    const pipelineName = getPipelineName();
    let url = urls.pipelineRuns.all();
    if (pipelineName && namespace && namespace !== ALL_NAMESPACES) {
      url = urls.pipelineRuns.byPipeline({
        namespace,
        pipelineName
      });
    } else if (namespace && namespace !== ALL_NAMESPACES) {
      url = urls.pipelineRuns.byNamespace({ namespace });
    }
    navigate(url);
  }

  function handleAddLabel(prop) {
    setState(prevState => ({
      ...prevState,
      [prop]: [
        ...prevState[prop],
        {
          id: generateId(`label${prevState[prop].length}-`),
          key: '',
          keyPlaceholder: 'key',
          value: '',
          valuePlaceholder: 'value'
        }
      ]
    }));
  }

  function handleRemoveLabel(prop, invalidProp, index) {
    setState(prevState => {
      const newLabels = [...prevState[prop]];
      const newInvalidLabels = { ...prevState[invalidProp] };
      const removedLabel = newLabels[index];
      newLabels.splice(index, 1);
      if (removedLabel.id in newInvalidLabels) {
        delete newInvalidLabels[`${removedLabel.id}-key`];
        delete newInvalidLabels[`${removedLabel.id}-value`];
      }
      return {
        ...prevState,
        [prop]: newLabels,
        [invalidProp]: newInvalidLabels
      };
    });
  }

  function handleChangeLabel(prop, invalidProp, { type, index, value }) {
    setState(prevState => {
      const newLabels = [...prevState[prop]];
      newLabels[index][type] = value;
      const newInvalidLabels = { ...prevState[invalidProp] };
      if (!isValidLabel(type, value)) {
        newInvalidLabels[`${newLabels[index].id}-${type}`] = true;
      } else {
        delete newInvalidLabels[`${newLabels[index].id}-${type}`];
      }
      return {
        ...prevState,
        [prop]: newLabels,
        [invalidProp]: newInvalidLabels
      };
    });
  }

  function handleNamespaceChange({ selectedItem }) {
    const { text = '' } = selectedItem || {};
    // Reset pipeline and ServiceAccount when namespace changes
    if (text !== namespace) {
      setState(state => ({
        ...state,
        ...initialState,
        namespace: text
      }));

      const queryParams = new URLSearchParams(location.search);
      if (text) {
        queryParams.set('namespace', text);
      } else {
        queryParams.delete('namespace');
      }
      queryParams.delete('pipelineName');
      const browserURL = location.pathname.concat(`?${queryParams.toString()}`);
      navigate(browserURL);
    }
  }

  function handleParamChange(key, value) {
    setState(state => ({
      ...state,
      params: {
        ...state.params,
        [key]: value
      }
    }));
  }

  function handlePipelineChange({ selectedItem }) {
    const { text } = selectedItem || {};

    const queryParams = new URLSearchParams(location.search);
    if (text) {
      queryParams.set('pipelineName', text);
    } else {
      queryParams.delete('pipelineName');
    }
    const browserURL = location.pathname.concat(`?${queryParams.toString()}`);
    navigate(browserURL);

    if (text && text !== pipelineRef) {
      setState(state => {
        return {
          ...state,
          pipelineRef: text,
          resources: initialResourcesState(resourceSpecs),
          params: initialParamsState(paramSpecs)
        };
      });
      return;
    }
    // Reset pipelineresources and params when no Pipeline is selected
    setState(state => ({
      ...state,
      ...initialState,
      namespace: state.namespace
    }));
  }

  function handleResourceChange(key, value) {
    setState(state => ({
      ...state,
      resources: {
        ...state.resources,
        [key]: value
      }
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    // Check form validation
    const valid = checkFormValidation();
    setState(state => ({
      ...state,
      validationError: !valid
    }));
    if (!valid) {
      return;
    }

    setState(state => ({ ...state, creating: true }));

    createPipelineRun({
      namespace,
      pipelineName: pipelineRef,
      pipelineRunName: pipelineRunName || undefined,
      resources,
      params,
      pipelinePendingStatus,
      serviceAccount,
      timeoutsFinally,
      timeoutsPipeline,
      timeoutsTasks,
      labels: labels.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {}),
      nodeSelector: nodeSelector.length
        ? nodeSelector.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
          }, {})
        : null
    })
      .then(() => {
        navigate(urls.pipelineRuns.byNamespace({ namespace }));
      })
      .catch(error => {
        error.response.text().then(text => {
          const statusCode = error.response.status;
          let errorMessage = `error code ${statusCode}`;
          if (text) {
            errorMessage = `${text} (error code ${statusCode})`;
          }
          setState(state => ({
            ...state,
            creating: false,
            submitError: errorMessage
          }));
        });
      });
  }

  if (isYAMLMode()) {
    const pipelineRun = getPipelineRunPayload({
      labels: labels.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {}),
      namespace,
      nodeSelector: nodeSelector.length
        ? nodeSelector.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
          }, {})
        : null,
      pipelineName: pipelineRef,
      pipelineRunName: pipelineRunName || undefined,
      params,
      pipelinePendingStatus,
      resources,
      serviceAccount,
      timeoutsFinally,
      timeoutsPipeline,
      timeoutsTasks
    });

    return <CreateYAMLEditor code={yaml.dump(pipelineRun)} />;
  }

  return (
    <div className="tkn--create">
      <div className="tkn--create--heading">
        <h1 id="main-content-header">
          {intl.formatMessage({
            id: 'dashboard.createPipelineRun.title',
            defaultMessage: 'Create PipelineRun'
          })}
        </h1>
        <div className="tkn--create--yaml-mode">
          <Button
            kind="tertiary"
            id="create-pipelinerun--mode-button"
            onClick={switchToYamlMode}
          >
            {intl.formatMessage({
              id: 'dashboard.createPipelineRun.yamlModeButton',
              defaultMessage: 'YAML Mode'
            })}
          </Button>
        </div>
      </div>
      <Form>
        {pipelineError && (
          <InlineNotification
            kind="error"
            title={intl.formatMessage({
              id: 'dashboard.createPipelineRun.errorLoading',
              defaultMessage: 'Error retrieving Pipeline information'
            })}
            lowContrast
          />
        )}
        {validationError && (
          <InlineNotification
            kind="error"
            title={intl.formatMessage({
              id: 'dashboard.createRun.validationError',
              defaultMessage: 'Please fix the fields with errors, then resubmit'
            })}
            lowContrast
          />
        )}
        {submitError !== '' && (
          <InlineNotification
            kind="error"
            title={intl.formatMessage({
              id: 'dashboard.createPipelineRun.createError',
              defaultMessage: 'Error creating PipelineRun'
            })}
            subtitle={submitError}
            onCloseButtonClick={resetError}
            lowContrast
          />
        )}
        <FormGroup legendText="">
          <NamespacesDropdown
            id="create-pipelinerun--namespaces-dropdown"
            invalid={validationError && !namespace}
            invalidText={intl.formatMessage({
              id: 'dashboard.createRun.invalidNamespace',
              defaultMessage: 'Namespace cannot be empty'
            })}
            selectedItem={namespace ? { id: namespace, text: namespace } : ''}
            onChange={handleNamespaceChange}
          />
          <PipelinesDropdown
            id="create-pipelinerun--pipelines-dropdown"
            namespace={namespace}
            invalid={validationError && !pipelineRef}
            invalidText={intl.formatMessage({
              id: 'dashboard.createPipelineRun.invalidPipeline',
              defaultMessage: 'Pipeline cannot be empty'
            })}
            selectedItem={
              pipelineRef ? { id: pipelineRef, text: pipelineRef } : ''
            }
            disabled={isDisabled()}
            onChange={handlePipelineChange}
          />
        </FormGroup>
        <FormGroup legendText="">
          <KeyValueList
            legendText={intl.formatMessage({
              id: 'dashboard.createRun.labels.legendText',
              defaultMessage: 'Labels'
            })}
            invalidText={
              <span
                dangerouslySetInnerHTML /* eslint-disable-line react/no-danger */={{
                  __html: intl.formatMessage(
                    {
                      id: 'dashboard.createRun.label.invalidText',
                      defaultMessage:
                        'Labels must follow the {0}kubernetes labels syntax{1}.'
                    },
                    [
                      `<a
                          href="https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#syntax-and-character-set"
                          target="_blank"
                          rel="noopener noreferrer"
                        >`,
                      '</a>'
                    ]
                  )
                }}
              />
            }
            keyValues={labels}
            minKeyValues={0}
            invalidFields={invalidLabels}
            onChange={label =>
              handleChangeLabel('labels', 'invalidLabels', label)
            }
            onRemove={index =>
              handleRemoveLabel('labels', 'invalidLabels', index)
            }
            onAdd={() => handleAddLabel('labels')}
          />
        </FormGroup>
        <FormGroup legendText="">
          <KeyValueList
            legendText={intl.formatMessage({
              id: 'dashboard.createRun.nodeSelector.legendText',
              defaultMessage: 'Node selector'
            })}
            invalidText={
              <span
                dangerouslySetInnerHTML /* eslint-disable-line react/no-danger */={{
                  __html: intl.formatMessage(
                    {
                      id: 'dashboard.createRun.label.invalidText',
                      defaultMessage:
                        'Labels must follow the {0}kubernetes labels syntax{1}.'
                    },
                    [
                      `<a
                          href="https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#syntax-and-character-set"
                          target="_blank"
                          rel="noopener noreferrer"
                        >`,
                      '</a>'
                    ]
                  )
                }}
              />
            }
            keyValues={nodeSelector}
            minKeyValues={0}
            invalidFields={invalidNodeSelector}
            onChange={label =>
              handleChangeLabel('nodeSelector', 'invalidNodeSelector', label)
            }
            onRemove={index =>
              handleRemoveLabel('nodeSelector', 'invalidNodeSelector', index)
            }
            onAdd={() => handleAddLabel('nodeSelector')}
          />
        </FormGroup>
        {resourceSpecs && resourceSpecs.length !== 0 && (
          <FormGroup legendText="PipelineResources">
            {resourceSpecs.map(resourceSpec => (
              <PipelineResourcesDropdown
                id={`create-pipelinerun--pr-dropdown-${resourceSpec.name}`}
                key={`create-pipelinerun--pr-dropdown-${resourceSpec.name}`}
                titleText={resourceSpec.name}
                helperText={resourceSpec.type}
                type={resourceSpec.type}
                namespace={namespace}
                invalid={validationError && !resources[resourceSpec.name]}
                invalidText={intl.formatMessage({
                  id: 'dashboard.createRun.invalidPipelineResources',
                  defaultMessage: 'PipelineResources cannot be empty'
                })}
                selectedItem={(() => {
                  const value = resources[resourceSpec.name];
                  return value ? { id: value, text: value } : '';
                })()}
                onChange={({ selectedItem }) => {
                  const { text } = selectedItem || {};
                  handleResourceChange(resourceSpec.name, text);
                }}
              />
            ))}
          </FormGroup>
        )}
        {paramSpecs && paramSpecs.length !== 0 && (
          <FormGroup legendText="Params">
            {paramSpecs.map(paramSpec => (
              <TextInput
                id={`create-pipelinerun--param-${paramSpec.name}`}
                key={`create-pipelinerun--param-${paramSpec.name}`}
                labelText={paramSpec.name}
                helperText={paramSpec.description}
                placeholder={paramSpec.default || paramSpec.name}
                invalid={
                  validationError &&
                  !params[paramSpec.name] &&
                  paramSpec.default !== ''
                }
                invalidText={intl.formatMessage({
                  id: 'dashboard.createRun.invalidParams',
                  defaultMessage: 'Params cannot be empty'
                })}
                value={params[paramSpec.name] || ''}
                onChange={({ target: { value } }) =>
                  handleParamChange(paramSpec.name, value)
                }
              />
            ))}
          </FormGroup>
        )}
        <FormGroup
          legendText={intl.formatMessage({
            id: 'dashboard.createRun.optional.legendText',
            defaultMessage: 'Optional values'
          })}
        >
          <ServiceAccountsDropdown
            id="create-pipelinerun--sa-dropdown"
            titleText="ServiceAccount"
            helperText={intl.formatMessage({
              id: 'dashboard.createPipelineRun.serviceAccountHelperText',
              defaultMessage:
                'Ensure the selected ServiceAccount (or the default if none selected) has permissions for creating PipelineRuns and for anything else your PipelineRun interacts with.'
            })}
            namespace={namespace}
            selectedItem={
              serviceAccount ? { id: serviceAccount, text: serviceAccount } : ''
            }
            disabled={isDisabled()}
            onChange={({ selectedItem }) => {
              const { text } = selectedItem || {};
              setState(state => ({ ...state, serviceAccount: text }));
            }}
          />
          <TextInput
            id="create-pipelinerun--pipelinerunname"
            labelText={intl.formatMessage({
              id: 'dashboard.createRun.pipelineRunNameLabel',
              defaultMessage: 'PipelineRun name'
            })}
            invalid={validationError && !validPipelineRunName}
            invalidText={intl.formatMessage({
              id: 'dashboard.createResource.nameError',
              defaultMessage:
                "Must consist of lower case alphanumeric characters, '-' or '.', start and end with an alphanumeric character, and be at most 63 characters"
            })}
            value={pipelineRunName}
            onChange={({ target: { value } }) =>
              setState(state => ({ ...state, pipelineRunName: value.trim() }))
            }
          />
          <FormGroup
            legendText={intl.formatMessage({
              id: 'dashboard.createRun.optional.timeouts',
              defaultMessage: 'Timeouts'
            })}
          >
            <TextInput
              id="create-pipelinerun--timeouts--pipeline"
              labelText="Pipeline"
              value={timeoutsPipeline}
              onChange={({ target: { value } }) =>
                setState(state => ({ ...state, timeoutsPipeline: value }))
              }
            />
            <TextInput
              id="create-pipelinerun--timeouts--tasks"
              labelText="Tasks"
              value={timeoutsTasks}
              onChange={({ target: { value } }) =>
                setState(state => ({ ...state, timeoutsTasks: value }))
              }
            />
            <TextInput
              id="create-pipelinerun--timeouts--finally"
              labelText="Finally"
              value={timeoutsFinally}
              onChange={({ target: { value } }) =>
                setState(state => ({ ...state, timeoutsFinally: value }))
              }
            />
          </FormGroup>
          <Toggle
            defaultToggled={false}
            id="pending-pipeline-toggle"
            labelText={intl.formatMessage({
              id: 'dashboard.createPipelineRun.status.pending',
              defaultMessage: 'Create PipelineRun in pending state'
            })}
            onToggle={checked}
            labelA={intl.formatMessage({
              id: 'dashboard.createPipelineRun.disabled',
              defaultMessage: 'Disabled'
            })}
            labelB={intl.formatMessage({
              id: 'dashboard.createPipelineRun.enabled',
              defaultMessage: 'Enabled'
            })}
          />
        </FormGroup>

        <Button
          iconDescription={intl.formatMessage({
            id: 'dashboard.actions.createButton',
            defaultMessage: 'Create'
          })}
          onClick={handleSubmit}
          disabled={creating}
        >
          {intl.formatMessage({
            id: 'dashboard.actions.createButton',
            defaultMessage: 'Create'
          })}
        </Button>

        <Button
          iconDescription={intl.formatMessage({
            id: 'dashboard.modal.cancelButton',
            defaultMessage: 'Cancel'
          })}
          kind="secondary"
          onClick={handleClose}
          disabled={creating}
        >
          {intl.formatMessage({
            id: 'dashboard.modal.cancelButton',
            defaultMessage: 'Cancel'
          })}
        </Button>
      </Form>
    </div>
  );
}

export default CreatePipelineRun;
