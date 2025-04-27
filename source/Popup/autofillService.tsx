export const handleAutofill = async (
  isMounted: React.MutableRefObject<boolean>
): Promise<string | null> => {
  try {
    // For Chrome
    if (typeof chrome !== "undefined" && chrome.tabs) {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!isMounted.current) {
            resolve(null);
            return;
          }

          const activeTab = tabs[0];
          if (!activeTab || !activeTab.id) {
            console.error("No active tab found");
            reject(new Error("No active tab found"));
            return;
          }

          // Check if scripting API is available in Chrome
          if (chrome.scripting) {
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTab.id },
                function: () => document.documentElement.outerHTML,
              },
              (results) => {
                if (!isMounted.current) {
                  resolve(null);
                  return;
                }

                if (chrome.runtime.lastError) {
                  console.error(
                    "Error fetching page HTML:",
                    chrome.runtime.lastError
                  );
                  reject(chrome.runtime.lastError);
                  return;
                }

                if (results && results[0]) {
                  const htmlContent = results[0].result;
                  console.log("HTML content fetched successfully");
                  resolve(htmlContent);
                } else {
                  reject(
                    new Error("No results returned from script execution")
                  );
                }
              }
            );
          } else {
            // Fallback for older Chrome versions using executeScript on tabs
            chrome.tabs.executeScript(
              activeTab.id,
              {
                code: "document.documentElement.outerHTML",
              },
              (results) => {
                if (!isMounted.current) {
                  resolve(null);
                  return;
                }

                if (chrome.runtime.lastError) {
                  console.error(
                    "Error fetching page HTML:",
                    chrome.runtime.lastError
                  );
                  reject(chrome.runtime.lastError);
                  return;
                }

                if (results && results[0]) {
                  const htmlContent = results[0];
                  console.log("HTML content fetched successfully");
                  resolve(htmlContent);
                } else {
                  reject(
                    new Error("No results returned from script execution")
                  );
                }
              }
            );
          }
        });
      });
    }
    // For Firefox
    else if (typeof browser !== "undefined" && browser.tabs) {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!isMounted.current) return null;

        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
          console.error("No active tab found");
          return null;
        }

        // Check if scripting API is available in Firefox
        if (browser.scripting) {
          const result = await browser.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => document.documentElement.outerHTML,
          });

          if (!isMounted.current) return null;

          const htmlContent = result[0].result;
          console.log("HTML content fetched successfully");
          return htmlContent;
        } else {
          // Fallback for older Firefox versions
          const result = await browser.tabs.executeScript(activeTab.id, {
            code: "document.documentElement.outerHTML",
          });

          if (!isMounted.current) return null;

          const htmlContent = result[0];
          console.log("HTML content fetched successfully");
          return htmlContent;
        }
      } catch (error) {
        console.error("Firefox error:", error);
        return null;
      }
    } else {
      console.error("Browser API not found");
      return null;
    }
  } catch (error) {
    console.error("Error fetching page HTML:", error);
    return null;
  }
};

export const processAutofillContent = (
  htmlContent: string
): Record<string, any> => {
  console.log(
    "Processing HTML for autofill:",
    htmlContent.substring(0, 100) + "..."
  );

  // Create a DOM parser to work with the HTML content
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // Initialize result object to store all form field information
  const formFields: Record<string, any> = {
    inputs: [],
    selects: [],
    textareas: [],
    formStructure: [],
  };

  // Find all forms in the document for structural information
  const forms = doc.querySelectorAll("form");
  forms.forEach((form, formIndex) => {
    const formInfo = {
      id: form.id || `form-${formIndex}`,
      action: form.getAttribute("action") || "",
      method: form.getAttribute("method") || "",
      name: form.getAttribute("name") || "",
      fields: [],
    };
    formFields.formStructure.push(formInfo);
  });

  // Process all input elements
  const inputs = doc.querySelectorAll("input");
  inputs.forEach((input) => {
    const inputType = input.getAttribute("type") || "text";

    const inputInfo = {
      type: inputType,
      id: input.id || "",
      name: input.getAttribute("name") || "",
      value: input.value || "",
      placeholder: input.getAttribute("placeholder") || "",
      className: input.className || "",
      required: input.hasAttribute("required"),
      disabled: input.hasAttribute("disabled"),
      maxLength: input.getAttribute("maxlength") || "",
      minLength: input.getAttribute("minlength") || "",
      formId: input.getAttribute("form") || findParentFormId(input),
      selector: generateUniqueSelector(input),
      label: findAssociatedLabel(input, doc),
    };

    // Add specific properties based on input type
    if (inputType === "radio" || inputType === "checkbox") {
      inputInfo["checked"] = input.hasAttribute("checked");
    } else if (inputType === "number" || inputType === "range") {
      inputInfo["min"] = input.getAttribute("min") || "";
      inputInfo["max"] = input.getAttribute("max") || "";
      inputInfo["step"] = input.getAttribute("step") || "";
    } else if (inputType === "date" || inputType === "datetime-local") {
      inputInfo["min"] = input.getAttribute("min") || "";
      inputInfo["max"] = input.getAttribute("max") || "";
    }

    formFields.inputs.push(inputInfo);
  });

  // Process all select elements
  const selects = doc.querySelectorAll("select");
  selects.forEach((select) => {
    const options = Array.from(select.querySelectorAll("option")).map(
      (option) => ({
        value: option.value || "",
        text: option.textContent || "",
        selected: option.selected,
      })
    );

    const selectInfo = {
      id: select.id || "",
      name: select.getAttribute("name") || "",
      value: select.value || "",
      multiple: select.hasAttribute("multiple"),
      required: select.hasAttribute("required"),
      disabled: select.hasAttribute("disabled"),
      className: select.className || "",
      formId: select.getAttribute("form") || findParentFormId(select),
      selector: generateUniqueSelector(select),
      label: findAssociatedLabel(select, doc),
      options: options,
    };

    formFields.selects.push(selectInfo);
  });

  // Process all textarea elements
  const textareas = doc.querySelectorAll("textarea");
  textareas.forEach((textarea) => {
    const textareaInfo = {
      id: textarea.id || "",
      name: textarea.getAttribute("name") || "",
      value: textarea.value || textarea.textContent || "",
      placeholder: textarea.getAttribute("placeholder") || "",
      required: textarea.hasAttribute("required"),
      disabled: textarea.hasAttribute("disabled"),
      maxLength: textarea.getAttribute("maxlength") || "",
      minLength: textarea.getAttribute("minlength") || "",
      rows: textarea.getAttribute("rows") || "",
      cols: textarea.getAttribute("cols") || "",
      className: textarea.className || "",
      formId: textarea.getAttribute("form") || findParentFormId(textarea),
      selector: generateUniqueSelector(textarea),
      label: findAssociatedLabel(textarea, doc),
    };

    formFields.textareas.push(textareaInfo);
  });

  // Helper function to find parent form ID
  function findParentFormId(element: Element): string {
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === "FORM") {
        return parent.id || "";
      }
      parent = parent.parentElement;
    }
    return "";
  }

  // Helper function to generate a unique CSS selector for an element
  function generateUniqueSelector(element: Element): string {
    // Try to generate a selector with ID if available
    if (element.id) {
      return `#${element.id}`;
    }

    // Try with name attribute
    const name = element.getAttribute("name");
    if (name) {
      const tagName = element.tagName.toLowerCase();
      return `${tagName}[name="${name}"]`;
    }

    // Try with a combination of attributes
    const type = element.getAttribute("type");
    if (type) {
      const tagName = element.tagName.toLowerCase();
      return `${tagName}[type="${type}"]`;
    }

    // If no unique attributes found, create a path-based selector
    let path = "";
    let current = element;
    while (current) {
      const tagName = current.tagName?.toLowerCase();
      if (!tagName || tagName === "html") break;

      let selector = tagName;
      if (current.id) {
        selector = `${tagName}#${current.id}`;
        path = selector + (path ? " > " + path : "");
        break;
      }

      let sibling = current.previousElementSibling;
      let index = 0;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      selector = index === 0 ? tagName : `${tagName}:nth-of-type(${index + 1})`;
      path = selector + (path ? " > " + path : "");

      current = current.parentElement;
    }

    return path;
  }

  // Helper function to find associated label for an input
  function findAssociatedLabel(element: Element, doc: Document): string {
    // Check for label with a "for" attribute matching the element's ID
    if (element.id) {
      const label = doc.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent?.trim() || "";
      }
    }

    // Check for a parent label element
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === "LABEL") {
        // Get the label text but exclude the text of the current element
        const clone = parent.cloneNode(true) as HTMLElement;
        const inputs = clone.querySelectorAll("input, select, textarea");
        inputs.forEach((input) => input.parentNode?.removeChild(input));
        return clone.textContent?.trim() || "";
      }
      parent = parent.parentElement;
    }

    // No label found
    return "";
  }

  // Generate a flattened map of selectors to field information for easy autofill
  const autofillMap: Record<string, any> = {};

  // Process inputs
  formFields.inputs.forEach((input) => {
    if (input.selector) {
      autofillMap[input.selector] = {
        type: input.type,
        name: input.name,
        id: input.id,
        label: input.label,
        value: input.value,
        fieldType: "input",
      };
    }
  });

  // Process selects
  formFields.selects.forEach((select) => {
    if (select.selector) {
      autofillMap[select.selector] = {
        type: "select",
        name: select.name,
        id: select.id,
        label: select.label,
        options: select.options,
        fieldType: "select",
      };
    }
  });

  // Process textareas
  formFields.textareas.forEach((textarea) => {
    if (textarea.selector) {
      autofillMap[textarea.selector] = {
        type: "textarea",
        name: textarea.name,
        id: textarea.id,
        label: textarea.label,
        value: textarea.value,
        fieldType: "textarea",
      };
    }
  });

  // Add the autofill map to the result
  formFields.autofillMap = autofillMap;

  console.log(
    `Found ${formFields.inputs.length} inputs, ${formFields.selects.length} selects, and ${formFields.textareas.length} textareas`
  );

  return formFields;
};

export const applyAutofill = async (
  isMounted: React.MutableRefObject<boolean>,
  autofillData: Record<string, string>
): Promise<boolean> => {
  try {
    // For Chrome
    if (typeof chrome !== "undefined" && chrome.tabs) {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!isMounted.current) {
            resolve(false);
            return;
          }

          const activeTab = tabs[0];
          if (!activeTab || !activeTab.id) {
            console.error("No active tab found");
            reject(new Error("No active tab found"));
            return;
          }

          // Create a string representation of the autofill function
          const autofillFunctionStr = `
            (function(data) {
              Object.entries(data).forEach(([selector, value]) => {
                const element = document.querySelector(selector);
                if (element) {
                  element.value = value;
                  // Trigger change event
                  const event = new Event('input', { bubbles: true });
                  element.dispatchEvent(event);
                }
              });
              return true;
            })(${JSON.stringify(autofillData)})
          `;

          // Check if scripting API is available in Chrome
          if (chrome.scripting) {
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTab.id },
                function: function (data) {
                  Object.entries(data).forEach(([selector, value]) => {
                    const element = document.querySelector(selector);
                    if (element) {
                      element.value = value;
                      // Trigger change event
                      const event = new Event("input", { bubbles: true });
                      element.dispatchEvent(event);
                    }
                  });
                  return true;
                },
                args: [autofillData],
              },
              (results) => {
                if (!isMounted.current) {
                  resolve(false);
                  return;
                }

                if (chrome.runtime.lastError) {
                  console.error(
                    "Error applying autofill:",
                    chrome.runtime.lastError
                  );
                  reject(chrome.runtime.lastError);
                  return;
                }

                console.log("Autofill applied successfully");
                resolve(true);
              }
            );
          } else {
            // Fallback for older Chrome versions using executeScript on tabs
            chrome.tabs.executeScript(
              activeTab.id,
              { code: autofillFunctionStr },
              (results) => {
                if (!isMounted.current) {
                  resolve(false);
                  return;
                }

                if (chrome.runtime.lastError) {
                  console.error(
                    "Error applying autofill:",
                    chrome.runtime.lastError
                  );
                  reject(chrome.runtime.lastError);
                  return;
                }

                console.log("Autofill applied successfully");
                resolve(true);
              }
            );
          }
        });
      });
    }
    // For Firefox
    else if (typeof browser !== "undefined" && browser.tabs) {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!isMounted.current) return false;

        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
          console.error("No active tab found");
          return false;
        }

        // Create a string representation of the autofill function
        const autofillFunctionStr = `
          (function(data) {
            Object.entries(${JSON.stringify(autofillData)}).forEach(([selector, value]) => {
              const element = document.querySelector(selector);
              if (element) {
                element.value = value;
                // Trigger change event
                const event = new Event('input', { bubbles: true });
                element.dispatchEvent(event);
              }
            });
            return true;
          })()
        `;

        if (browser.scripting) {
          const result = await browser.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (data) => {
              Object.entries(data).forEach(([selector, value]) => {
                const element = document.querySelector(selector);
                if (element) {
                  element.value = value;
                  // Trigger change event
                  const event = new Event("input", { bubbles: true });
                  element.dispatchEvent(event);
                }
              });
              return true;
            },
            args: [autofillData],
          });

          if (!isMounted.current) return false;

          console.log("Autofill applied successfully");
          return true;
        } else {
          // Fallback for older Firefox versions
          const result = await browser.tabs.executeScript(activeTab.id, {
            code: autofillFunctionStr,
          });

          if (!isMounted.current) return false;

          console.log("Autofill applied successfully");
          return true;
        }
      } catch (error) {
        console.error("Firefox error applying autofill:", error);
        return false;
      }
    } else {
      console.error("Browser API not found");
      return false;
    }
  } catch (error) {
    console.error("Error applying autofill:", error);
    return false;
  }
};
