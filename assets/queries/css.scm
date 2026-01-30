(call_expression
  (function_name) @name (#eq? @name "var")
  (arguments (string) @signature))

(rule_set
  (selectors (class_selector) @signature)
  (block) @ignore)
