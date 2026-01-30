(comment) @ignore

(call_expression
  (function_name) @name (#eq? @name "var")
  (arguments (_) @signature))

(rule_set
  (selectors (class_selector) @signature)
  (block) @ignore)
