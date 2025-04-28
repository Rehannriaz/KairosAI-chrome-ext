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
const uploadToFileInputs = async (
  activeTabId,
  fileData,
  fileName,
  fileType
) => {
  // Create a script that will:
  // 1. Find all file inputs
  // 2. Try to upload to each one
  const uploadScript = `
    (function() {
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const results = [];
      
      if (fileInputs.length === 0) {
        return { success: false, message: 'No file inputs found' };
      }
      
      for (let i = 0; i < fileInputs.length; i++) {
        const input = fileInputs[i];
        try {
          // Create a File object
          const uint8Array = new Uint8Array(${JSON.stringify(fileData)});
          const blob = new Blob([uint8Array], { type: '${fileType}' });
          const file = new File([blob], '${fileName}', { type: '${fileType}' });
          
          // Use DataTransfer to set the file
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          
          // Trigger change event
          const event = new Event('change', { bubbles: true });
          input.dispatchEvent(event);
          
          results.push({
            index: i,
            success: true,
            info: {
              id: input.id || '[no id]',
              name: input.name || '[no name]'
            }
          });
        } catch (err) {
          results.push({
            index: i,
            success: false,
            error: err.message,
            info: {
              id: input.id || '[no id]',
              name: input.name || '[no name]'
            }
          });
        }
      }
      
      return { 
        success: results.some(r => r.success), 
        results: results 
      };
    })()
  `;

  return new Promise((resolve, reject) => {
    try {
      if (
        chrome.scripting &&
        typeof chrome.scripting.executeScript === "function"
      ) {
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTabId },
            func: (fileDataArr, fileName, fileType) => {
              // Same function body as above
              const fileInputs = Array.from(
                document.querySelectorAll('input[type="file"]')
              );
              const results = [];

              if (fileInputs.length === 0) {
                return { success: false, message: "No file inputs found" };
              }

              for (let i = 0; i < fileInputs.length; i++) {
                const input = fileInputs[i];
                try {
                  // Create a File object
                  const uint8Array = new Uint8Array(fileDataArr);
                  const blob = new Blob([uint8Array], { type: fileType });
                  const file = new File([blob], fileName, { type: fileType });

                  // Use DataTransfer to set the file
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  input.files = dataTransfer.files;

                  // Trigger change event
                  const event = new Event("change", { bubbles: true });
                  input.dispatchEvent(event);

                  results.push({
                    index: i,
                    success: true,
                    info: {
                      id: input.id || "[no id]",
                      name: input.name || "[no name]",
                    },
                  });
                } catch (err) {
                  results.push({
                    index: i,
                    success: false,
                    error: err.message,
                    info: {
                      id: input.id || "[no id]",
                      name: input.name || "[no name]",
                    },
                  });
                }
              }

              return {
                success: results.some((r) => r.success),
                results: results,
              };
            },
            args: [fileData, fileName, fileType],
          },
          (results) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              resolve(results[0].result);
            }
          }
        );
      } else if (
        chrome.tabs &&
        typeof chrome.tabs.executeScript === "function"
      ) {
        chrome.tabs.executeScript(
          activeTabId,
          { code: uploadScript },
          (results) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              resolve(results[0]);
            }
          }
        );
      } else {
        resolve({ success: false, error: "No execution method available" });
      }
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
};
export const applyAutofill = async (
  isMounted: React.MutableRefObject<boolean>,
  autofillData: Record<string, string>,
  selectedResume?: Resume // Add the selected resume parameter
): Promise<boolean> => {
  try {
    // For Chrome
    if (typeof chrome !== "undefined" && chrome.tabs) {
      return new Promise((resolve, reject) => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async (tabs) => {
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

            // First, identify file inputs that need to be handled separately
            // First, identify file inputs that need to be handled separately
            // In your applyAutofill function, replace the file handling section:
            if (selectedResume?.file_url) {
              try {
                console.log(
                  "Attempting to handle file upload for resume:",
                  selectedResume.name
                );

                // Enhanced file detection - try both scripting and fallback methods
                let fileInputs = [];

                if (
                  chrome.scripting &&
                  typeof chrome.scripting.executeScript === "function"
                ) {
                  try {
                    const fileInputDetectionResult =
                      await chrome.scripting.executeScript({
                        target: { tabId: activeTab.id },
                        func: () => {
                          // Comprehensive file input detection
                          let inputs = Array.from(
                            document.querySelectorAll('input[type="file"]')
                          );

                          // Also check for file inputs without proper type attribute
                          if (inputs.length === 0) {
                            inputs = Array.from(
                              document.getElementsByTagName("input")
                            ).filter(
                              (input) =>
                                input.accept &&
                                (input.accept.includes("pdf") ||
                                  input.accept.includes("doc") ||
                                  input.accept.includes("application"))
                            );
                          }

                          return inputs.map((input) => ({
                            selector: input.id
                              ? `#${input.id}`
                              : input.name
                                ? `input[name="${input.name}"]`
                                : null,
                            id: input.id || "",
                            name: input.name || "",
                            accept: input.getAttribute("accept") || "",
                            index: Array.from(
                              document.querySelectorAll("input")
                            ).indexOf(input),
                          }));
                        },
                      });

                    fileInputs = fileInputDetectionResult[0].result;
                    console.log(
                      "Detected file inputs via scripting API:",
                      fileInputs
                    );
                  } catch (error) {
                    console.error(
                      "Error using scripting API for file detection:",
                      error
                    );
                  }
                }

                // If no inputs found or error occurred, try the fallback
                if (!fileInputs || fileInputs.length === 0) {
                  console.log("Using fallback method for file detection");

                  try {
                    const fileDetectionCode = `
          (function() {
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            console.log("Raw file inputs found:", fileInputs.length);
            
            // Map to desired format
            return fileInputs.map((input, index) => ({
              selector: input.id ? '#' + input.id : 
                      input.name ? 'input[name="' + input.name + '"]' : 
                      'input[type="file"]:nth-of-type(' + (index+1) + ')',
              id: input.id || '',
              name: input.name || '',
              accept: input.getAttribute("accept") || "",
              index: index
            }));
          })()
        `;

                    const results = await new Promise((resolve) => {
                      chrome.tabs.executeScript(
                        activeTab.id,
                        { code: fileDetectionCode },
                        (results) => {
                          if (chrome.runtime.lastError) {
                            console.error(
                              "Error in fallback detection:",
                              chrome.runtime.lastError
                            );
                            resolve([]);
                          } else {
                            resolve(results[0] || []);
                          }
                        }
                      );
                    });

                    fileInputs = results;
                    console.log("Detected file inputs (fallback):", fileInputs);
                  } catch (error) {
                    console.error(
                      "Error in fallback file input detection:",
                      error
                    );
                  }
                }

                // If file inputs found, fetch and upload the resume
                if (fileInputs && fileInputs.length > 0) {
                  try {
                    // Fetch the resume file
                    const response = await fetch(selectedResume.file_url);
                    if (!response.ok)
                      throw new Error("Failed to fetch resume file");

                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = Array.from(new Uint8Array(arrayBuffer));

                    // Get file extension and MIME type
                    const fileExt =
                      selectedResume.file_url.split(".").pop()?.toLowerCase() ||
                      "pdf";
                    const mimeType =
                      fileExt === "pdf"
                        ? "application/pdf"
                        : fileExt === "docx"
                          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          : fileExt === "doc"
                            ? "application/msword"
                            : "application/octet-stream";

                    const fileName = `${selectedResume.name}.${fileExt}`;

                    // Try to upload to all file inputs
                    const uploadResult = await uploadToFileInputs(
                      activeTab.id,
                      buffer,
                      fileName,
                      mimeType
                    );

                    console.log("File upload result:", uploadResult);
                  } catch (error) {
                    console.error("Error processing resume file:", error);
                  }
                } else {
                  console.warn("No file inputs found for resume upload");
                }
              } catch (error) {
                console.error("Error in file upload process:", error);
              }
            }

            // Now handle the regular form fields (original logic preserved)
            // Check if scripting API is available in Chrome
            if (chrome.scripting) {
              chrome.scripting.executeScript(
                {
                  target: { tabId: activeTab.id },
                  func: function (data) {
                    const results = {
                      success: [],
                      failed: [],
                    };

                    Object.entries(data).forEach(([selector, value]) => {
                      let element;

                      // Special handling for selectors with brackets
                      if (selector.includes("[") && selector.includes("]")) {
                        // Handle custom questions with bracket notation in ID
                        if (selector.startsWith("#customQuestions")) {
                          const customId = selector.replace("#", "");
                          element = document.getElementById(customId);
                        }
                        // Handle other attribute selectors
                        else {
                          element = document.querySelector(selector);
                        }
                      } else {
                        element = document.querySelector(selector);
                      }

                      if (element) {
                        // Skip file inputs as we handle them separately
                        if (element.type === "file") return;

                        // Set the value
                        element.value = value;

                        // Trigger events for proper form handling
                        const inputEvent = new Event("input", {
                          bubbles: true,
                        });
                        element.dispatchEvent(inputEvent);

                        const changeEvent = new Event("change", {
                          bubbles: true,
                        });
                        element.dispatchEvent(changeEvent);

                        // If it's a select element, make sure the option is selected
                        if (element.tagName === "SELECT") {
                          for (let i = 0; i < element.options.length; i++) {
                            if (element.options[i].value === value) {
                              element.options[i].selected = true;
                              break;
                            }
                          }
                        }

                        results.success.push(selector);
                      } else {
                        // Try with a different approach for IDs with special characters
                        if (selector.startsWith("#")) {
                          const id = selector.substring(1);
                          // Try to escape special characters in ID
                          try {
                            element = document.querySelector(`[id="${id}"]`);
                            if (element) {
                              if (element.type === "file") return;

                              element.value = value;
                              const inputEvent = new Event("input", {
                                bubbles: true,
                              });
                              element.dispatchEvent(inputEvent);
                              const changeEvent = new Event("change", {
                                bubbles: true,
                              });
                              element.dispatchEvent(changeEvent);
                              results.success.push(selector);
                              return;
                            }
                          } catch (e) {
                            console.error(
                              "Error with alternate selector method:",
                              e
                            );
                          }
                        }

                        results.failed.push(selector);
                        console.warn(
                          "Element not found for selector:",
                          selector
                        );
                      }
                    });

                    console.log("Autofill results:", results);
                    return results;
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

                  console.log("Autofill applied successfully", results);
                  resolve(true);
                }
              );
            } else {
              // Fallback for older Chrome versions using executeScript on tabs
              const autofillFunctionStr = `
              (function(data) {
                const results = {
                  success: [],
                  failed: []
                };
                
                Object.entries(data).forEach(([selector, value]) => {
                  let element;
                  
                  // Special handling for selectors with brackets
                  if (selector.includes('[') && selector.includes(']')) {
                    // Handle custom questions with bracket notation in ID
                    if (selector.startsWith('#customQuestions')) {
                      const customId = selector.replace('#', '');
                      element = document.getElementById(customId);
                    } 
                    // Handle other attribute selectors
                    else {
                      element = document.querySelector(selector);
                    }
                  } else {
                    element = document.querySelector(selector);
                  }
                  
                  if (element) {
                    // Skip file inputs
                    if (element.type === 'file') return;
                    
                    // Set the value
                    element.value = value;
                    
                    // Trigger events for proper form handling
                    const inputEvent = new Event('input', { bubbles: true });
                    element.dispatchEvent(inputEvent);
                    
                    const changeEvent = new Event('change', { bubbles: true });
                    element.dispatchEvent(changeEvent);
                    
                    // If it's a select element, make sure the option is selected
                    if (element.tagName === 'SELECT') {
                      for (let i = 0; i < element.options.length; i++) {
                        if (element.options[i].value === value) {
                          element.options[i].selected = true;
                          break;
                        }
                      }
                    }
                    
                    results.success.push(selector);
                  } else {
                    // Try with a different approach for IDs with special characters
                    if (selector.startsWith('#')) {
                      const id = selector.substring(1);
                      try {
                        element = document.querySelector(\`[id="\${id}"]\`);
                        if (element) {
                          if (element.type === 'file') return;
                          
                          element.value = value;
                          const inputEvent = new Event('input', { bubbles: true });
                          element.dispatchEvent(inputEvent);
                          const changeEvent = new Event('change', { bubbles: true });
                          element.dispatchEvent(changeEvent);
                          results.success.push(selector);
                          return;
                        }
                      } catch (e) {
                        console.error("Error with alternate selector method:", e);
                      }
                    }
                    
                    results.failed.push(selector);
                    console.warn("Element not found for selector:", selector);
                  }
                });
                
                console.log("Autofill results:", results);
                return results;
              })(${JSON.stringify(autofillData)})
            `;

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
          }
        );
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

        // Handle file inputs for Firefox (if selectedResume is provided)
        if (selectedResume?.file_url && browser.scripting) {
          try {
            const fileInputResult = await browser.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: () => {
                return Array.from(
                  document.querySelectorAll('input[type="file"]')
                )
                  .map((input) => ({
                    selector: input.id
                      ? `#${input.id}`
                      : input.name
                        ? `input[name="${input.name}"]`
                        : null,
                    id: input.id,
                    name: input.name,
                  }))
                  .filter((input) => input.selector);
              },
            });

            const fileInputs = fileInputResult[0].result;

            if (fileInputs.length > 0) {
              // Fetch resume file
              const response = await fetch(selectedResume.file_url);
              const blob = await response.blob();
              const buffer = Array.from(
                new Uint8Array(await blob.arrayBuffer())
              );

              const fileExt =
                selectedResume.file_url.split(".").pop()?.toLowerCase() ||
                "pdf";
              const mimeType =
                fileExt === "pdf"
                  ? "application/pdf"
                  : fileExt === "docx"
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : fileExt === "doc"
                      ? "application/msword"
                      : "application/octet-stream";

              // Upload to each file input
              for (const fileInput of fileInputs) {
                await browser.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  func: (selector, fileData, fileName, fileType) => {
                    const input = document.querySelector(selector);
                    if (!input) return false;

                    try {
                      const uint8Array = new Uint8Array(fileData);
                      const blob = new Blob([uint8Array], { type: fileType });
                      const file = new File([blob], fileName, {
                        type: fileType,
                      });

                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      input.files = dataTransfer.files;

                      const event = new Event("change", { bubbles: true });
                      input.dispatchEvent(event);
                      return true;
                    } catch (err) {
                      console.error("Error setting file:", err);
                      return false;
                    }
                  },
                  args: [
                    fileInput.selector,
                    buffer,
                    selectedResume.name + "." + fileExt,
                    mimeType,
                  ],
                });
              }
            }
          } catch (error) {
            console.error("Error handling file inputs in Firefox:", error);
          }
        }

        // Handle regular form fields (original Firefox logic preserved)
        const autofillFunctionStr = `
          (function() {
            const data = ${JSON.stringify(autofillData)};
            const results = {
              success: [],
              failed: []
            };
            
            Object.entries(data).forEach(([selector, value]) => {
              let element;
              
              // Special handling for selectors with brackets
              if (selector.includes('[') && selector.includes(']')) {
                // Handle custom questions with bracket notation in ID
                if (selector.startsWith('#customQuestions')) {
                  const customId = selector.replace('#', '');
                  element = document.getElementById(customId);
                } 
                // Handle other attribute selectors
                else {
                  element = document.querySelector(selector);
                }
              } else {
                element = document.querySelector(selector);
              }
              
              if (element) {
                // Skip file inputs
                if (element.type === 'file') return;
                
                element.value = value;
                const inputEvent = new Event('input', { bubbles: true });
                element.dispatchEvent(inputEvent);
                const changeEvent = new Event('change', { bubbles: true });
                element.dispatchEvent(changeEvent);
                results.success.push(selector);
              } else {
                // Try with a different approach for IDs with special characters
                if (selector.startsWith('#')) {
                  const id = selector.substring(1);
                  try {
                    element = document.querySelector(\`[id="\${id}"]\`);
                    if (element) {
                      if (element.type === 'file') return;
                      
                      element.value = value;
                      const inputEvent = new Event('input', { bubbles: true });
                      element.dispatchEvent(inputEvent);
                      const changeEvent = new Event('change', { bubbles: true });
                      element.dispatchEvent(changeEvent);
                      results.success.push(selector);
                      return;
                    }
                  } catch (e) {
                    console.error("Error with alternate selector method:", e);
                  }
                }
                
                results.failed.push(selector);
                console.warn("Element not found for selector:", selector);
              }
            });
            
            console.log("Autofill results:", results);
            return results;
          })()
        `;

        if (browser.scripting) {
          const result = await browser.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (data) => {
              const results = {
                success: [],
                failed: [],
              };

              Object.entries(data).forEach(([selector, value]) => {
                let element;

                // Special handling for selectors with brackets
                if (selector.includes("[") && selector.includes("]")) {
                  // Handle custom questions with bracket notation in ID
                  if (selector.startsWith("#customQuestions")) {
                    const customId = selector.replace("#", "");
                    element = document.getElementById(customId);
                  }
                  // Handle other attribute selectors
                  else {
                    element = document.querySelector(selector);
                  }
                } else {
                  element = document.querySelector(selector);
                }

                if (element) {
                  // Skip file inputs
                  if (element.type === "file") return;

                  element.value = value;
                  const inputEvent = new Event("input", { bubbles: true });
                  element.dispatchEvent(inputEvent);
                  const changeEvent = new Event("change", { bubbles: true });
                  element.dispatchEvent(changeEvent);
                  results.success.push(selector);
                } else {
                  results.failed.push(selector);
                  console.warn("Element not found for selector:", selector);
                }
              });

              return results;
            },
            args: [autofillData],
          });

          if (!isMounted.current) return false;

          console.log("Autofill applied successfully", result);
          return true;
        } else {
          // Fallback for older Firefox versions
          const result = await browser.tabs.executeScript(activeTab.id, {
            code: autofillFunctionStr,
          });

          if (!isMounted.current) return false;

          console.log("Autofill applied successfully", result);
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
