import pytest

from backend.services.safety import SafetyCheckUnavailable, SafetyDecision


class FakeSafetyChecker:
    def __init__(self):
        self.input_safe = True
        self.output_safe = True
        self.fail_stage = None
        self.calls = []

    def check_input(self, question, history):
        self.calls.append(("input", question))
        if self.fail_stage == "input":
            raise SafetyCheckUnavailable("unavailable")
        return SafetyDecision(self.input_safe)

    def check_output(self, question, response, history):
        self.calls.append(("output", response))
        if self.fail_stage == "output":
            raise SafetyCheckUnavailable("unavailable")
        return SafetyDecision(True, self.output_safe)


@pytest.fixture
def safety_checker():
    return FakeSafetyChecker()
