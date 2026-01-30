(comment) @ignore

(identifier) @maybe_definition

(statement_block) @ignore
(class_body) @ignore
(object_type) @ignore

(call_expression
  function: [
    (identifier) @call_name
    (member_expression property: (property_identifier) @call_name)
  ]
  arguments: (arguments [(string) (template_string)] @call_arg_literal)
) @call_site