<?php

namespace App\Http\Requests;

use App\Support\SearchTerms;
use Illuminate\Foundation\Http\FormRequest;

class SearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Below the MySQL token size the query cannot match anything, so
            // reject it rather than return an empty list that reads as "no notes".
            'q' => ['required', 'string', 'min:'.SearchTerms::MIN_TOKEN, 'max:120'],
        ];
    }
}
