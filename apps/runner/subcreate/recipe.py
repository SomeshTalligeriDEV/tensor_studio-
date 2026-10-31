"""Strict, data-only recipe contract. Unsupported blocks cannot reach assembly."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class EmptyParams(StrictModel):
    pass


class Task(StrictModel):
    block: Literal['qa', 'classify']
    params: EmptyParams = Field(default_factory=EmptyParams)


class DatasetParams(StrictModel):
    file: Literal['custom.jsonl']


class GroundTruth(StrictModel):
    block: Literal['dataset']
    params: DatasetParams


class Scoring(StrictModel):
    block: Literal['exact_or_fuzzy', 'latency_bonus']
    weight: float = Field(gt=0, le=1, allow_inf_nan=False)


class EmaParams(StrictModel):
    alpha: float = Field(default=0.2, gt=0, le=1, allow_inf_nan=False)


class TopKParams(StrictModel):
    k: int = Field(default=2, ge=1, le=256)


class EmaWeights(StrictModel):
    block: Literal['ema_normalize']
    params: EmaParams = Field(default_factory=EmaParams)


class TopKWeights(StrictModel):
    block: Literal['top_k']
    params: TopKParams = Field(default_factory=TopKParams)


class Brief(StrictModel):
    problem: str = Field(min_length=1, max_length=1000)
    who_benefits: str = Field(min_length=1, max_length=1000)
    what_miners_do: str = Field(min_length=1, max_length=1000)
    how_validators_check: str = Field(min_length=1, max_length=1000)
    how_rewards_flow: str = Field(min_length=1, max_length=1000)
    how_cheaters_lose: str = Field(min_length=1, max_length=1000)
    why_this_design: str = Field(min_length=1, max_length=1000)
    alternative_considered: str = Field(min_length=1, max_length=1000)


class Recipe(StrictModel):
    problem: str = Field(min_length=1, max_length=2000)
    task: Task
    ground_truth: GroundTruth
    scoring: list[Scoring] = Field(min_length=1, max_length=2)
    anti_cheat: list[Literal['copy_penalty', 'timeout_zero']] = Field(min_length=1, max_length=2)
    weights: EmaWeights | TopKWeights = Field(discriminator="block")
    brief: Brief

    @model_validator(mode='after')
    def compatible(self):
        names = [item.block for item in self.scoring]
        if len(names) != len(set(names)) or 'exact_or_fuzzy' not in names:
            raise ValueError('Scoring needs exactly one exact_or_fuzzy block, optionally latency_bonus.')
        if abs(sum(item.weight for item in self.scoring) - 1) > 1e-9:
            raise ValueError('Scoring weights must sum to 1.')
        if len(self.anti_cheat) != len(set(self.anti_cheat)) or 'timeout_zero' not in self.anti_cheat:
            raise ValueError('Anti-cheat blocks must be unique and include timeout_zero.')
        return self


class DatasetRow(StrictModel):
    input: str = Field(min_length=1, max_length=4096)
    answer: str = Field(min_length=1, max_length=4096)

    @model_validator(mode='after')
    def nonempty(self):
        if not self.input.strip() or not self.answer.strip():
            raise ValueError('Dataset inputs and answers must not be blank.')
        return self


class LiveAssembly(StrictModel):
    recipe: Recipe
    dataset: list[DatasetRow] = Field(min_length=2, max_length=1000)

    @model_validator(mode='after')
    def validate_dataset(self):
        if self.recipe.ground_truth.params.file != 'custom.jsonl':
            raise ValueError('Live projects require a supplied custom dataset.')
        normalized = [' '.join(row.input.casefold().split()) for row in self.dataset]
        if len(set(normalized)) != len(normalized):
            raise ValueError('Dataset inputs must be unique.')
        if sum(len(row.input.encode()) + len(row.answer.encode()) for row in self.dataset) > 2 * 1024 * 1024:
            raise ValueError('Dataset exceeds 2 MiB.')
        if self.recipe.task.block == 'classify':
            labels = {row.answer for row in self.dataset}
            if not 2 <= len(labels) <= 32 or any(len(label) > 80 for label in labels):
                raise ValueError('Classification needs 2–32 distinct labels of at most 80 characters.')
            if 'copy_penalty' in self.recipe.anti_cheat:
                raise ValueError('Identical classification labels are not evidence of copying; remove copy_penalty.')
        return self
